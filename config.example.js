// SafeGain 应用配置示例文件
// 复制此文件为 config.js 并填入真实的配置信息

const config = {
    // 火山引擎API配置
    volcanoEngine: {
        apiKey: 'YOUR_API_KEY_HERE', // 请替换为您的API密钥
        endpointId: 'YOUR_ENDPOINT_ID_HERE' // 请替换为您的接入点ID
    },

    // 应用配置
    app: {
        name: 'SafeGain',
        version: '1.0.0',
        description: '安全增重健康管理系统'
    }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
} else {
    window.config = config;
}