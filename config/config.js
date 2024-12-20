import AWS from "aws-sdk";

const getSecrets = async () => {
  if (process.env.NODE_ENV === "production") {
    // 建議添加錯誤重試機制
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const ssm = new AWS.SSM({
          region: process.env.AWS_REGION || "ap-northeast-1",
        });

        const params = await ssm
          .getParameters({
            Names: [
              "/goaltracker/mongodb-uri",
              "/goaltracker/jwt-secret",
              "/goaltracker/email-user",
              // ... 其他參數
            ],
            WithDecryption: true,
          })
          .promise();

        // 檢查是否所有參數都成功獲取
        const missingParams = params.InvalidParameters;
        if (missingParams && missingParams.length > 0) {
          throw new Error(`Missing parameters: ${missingParams.join(", ")}`);
        }

        return {
          mongodbUri: params.Parameters.find(
            (p) => p.Name === "/goaltracker/mongodb-uri"
          ).Value,
          jwtSecret: params.Parameters.find(
            (p) => p.Name === "/goaltracker/jwt-secret"
          ).Value,
          // ... 其他配置
        };
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error("無法獲取 AWS 參數，已重試最大次數:", error);
          throw error;
        }
        // 等待後重試
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  // 本地開發使用環境變數
  return {
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    // ... 其他配置
  };
};

export default await getSecrets();
