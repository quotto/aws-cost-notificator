import AWS from "aws-sdk";
import axios from "axios";
import Request from "aws-lambda";

const MONTH_STRING = [
    "Jan",
    "Feb",
    "Mar",
    "Apl",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]
export const handler = async(event:Request) =>{
    // 毎月1日に実行されるため前日の日付＝前月最終日を取得する
    const target = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const start = `${target.toISOString().substring(0,8)}01`;
    const end = target.toISOString().substring(0,10);

    const params: AWS.CostExplorer.GetCostAndUsageRequest  = {
        Granularity: "MONTHLY",
        GroupBy: [
            {
                Key: "SERVICE",
                Type: "DIMENSION"
            }
        ],
        Metrics: [
            "BLENDED_COST"
        ],
        TimePeriod: {
            Start: start,
            End: end
        }
    }

    AWS.config.apiVersions = {
        costexplorer: "2017-10-25"
    }
    AWS.config.region = "us-east-1";

    const costexplorer = new AWS.CostExplorer();
    console.log(JSON.stringify(params));
    const response = await new Promise((resolve,_)=>{
            costexplorer.getCostAndUsage(params,(err,data)=>{
            if(err) {
                console.error(JSON.stringify(err));
                resolve({
                    statusCode: 503,
                    body: err
                });
            } else {
                console.log(JSON.stringify(data));
                if(data.ResultsByTime && data.ResultsByTime.length > 0) {
                    if(data.ResultsByTime[0].Groups) {
                        const cost_list: string[] = [];
                        data.ResultsByTime[0].Groups.forEach((group)=>{
                           if(group.Metrics && group.Metrics.BlendedCost && group.Keys) {
                               const amount_num = Number(group.Metrics.BlendedCost.Amount);
                               if(amount_num > 0) {
                                    cost_list.push(`${group.Keys[0]}: $${amount_num}`);
                               }
                            }
                        });
                        const message = cost_list.length > 0 ?
                            `${MONTH_STRING[target.getUTCMonth()]} ${target.getUTCFullYear()}\n ${cost_list.join("\n")}` : 'Nothing';
                        if(process.env.SLACK_WEBHOOK_URL) {
                            return axios.post(
                                process.env.SLACK_WEBHOOK_URL,
                                {
                                    text: message
                                }
                            ).then(reason=>{
                                resolve({
                                    statusCode: 200,
                                    body: "Slackに送信しました"
                                })
                            }).catch(error=>{
                                console.error(error);
                                resolve({
                                    statusCode: 503,
                                    body: "Slackの送信に失敗しました"
                                });
                            });
                        } else {
                            resolve({
                                statusCode: 503,
                                body: "SlackのWebHook用URLが設定されていません"
                            });
                        }
                    }
                }
                resolve({
                    statusCode: 503,
                    body: "Unexpected Error"
                });
            }
        });
    });
    return response;
}