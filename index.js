"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const axios_1 = __importDefault(require("axios"));
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
];
const handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    // 毎月1日に実行されるため前日の日付＝前月最終日を取得する
    const target = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const start = `${target.toISOString().substring(0, 8)}01`;
    const end = target.toISOString().substring(0, 10);
    const params = {
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
    };
    aws_sdk_1.default.config.apiVersions = {
        costexplorer: "2017-10-25"
    };
    aws_sdk_1.default.config.region = "us-east-1";
    const costexplorer = new aws_sdk_1.default.CostExplorer();
    console.log(JSON.stringify(params));
    const response = yield new Promise((resolve, _) => {
        costexplorer.getCostAndUsage(params, (err, data) => {
            if (err) {
                console.error(JSON.stringify(err));
                resolve({
                    statusCode: 503,
                    body: err
                });
            }
            else {
                console.log(JSON.stringify(data));
                if (data.ResultsByTime && data.ResultsByTime.length > 0) {
                    if (data.ResultsByTime[0].Groups) {
                        const cost_list = [];
                        data.ResultsByTime[0].Groups.forEach((group) => {
                            if (group.Metrics && group.Metrics.BlendedCost && group.Keys) {
                                const amount_num = Number(group.Metrics.BlendedCost.Amount);
                                if (amount_num > 0) {
                                    cost_list.push(`${group.Keys[0]}: $${amount_num}`);
                                }
                            }
                        });
                        const message = cost_list.length > 0 ?
                            `${MONTH_STRING[target.getUTCMonth()]} ${target.getUTCFullYear()}\n ${cost_list.join("\n")}` : 'Nothing';
                        if (process.env.SLACK_WEBHOOK_URL) {
                            return axios_1.default.post(process.env.SLACK_WEBHOOK_URL, {
                                text: message
                            }).then(reason => {
                                resolve({
                                    statusCode: 200,
                                    body: "Slackに送信しました"
                                });
                            }).catch(error => {
                                console.error(error);
                                resolve({
                                    statusCode: 503,
                                    body: "Slackの送信に失敗しました"
                                });
                            });
                        }
                        else {
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
});
exports.handler = handler;
