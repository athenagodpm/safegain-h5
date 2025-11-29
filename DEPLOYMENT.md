# SafeGain H5 应用部署指南

## 🚀 部署到 GitHub

### 1. 准备工作

确保你已经：
- 创建了 GitHub 账户
- 安装了 Git 工具

### 2. 安全配置设置

⚠️ **重要：不要将真实的 API 密钥提交到 GitHub！**

1. **复制配置文件模板**：
   ```bash
   cp config.example.js config.js
   ```

2. **编辑配置文件**：
   ```javascript
   const config = {
       volcanoEngine: {
           apiKey: 'YOUR_REAL_API_KEY', // 替换为真实的API密钥
           endpointId: 'YOUR_REAL_ENDPOINT_ID' // 替换为真实的接入点ID
       }
   };
   ```

3. **验证 .gitignore 文件**：
   确保 `config.js` 已在 `.gitignore` 中，不会被提交到仓库

### 3. 初始化 Git 仓库

```bash
# 初始化仓库
git init

# 添加远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/yourusername/safegain-h5.git

# 添加文件到暂存区
git add .

# 提交文件
git commit -m "Initial commit: SafeGain H5 health management app"

# 推送到 GitHub
git push -u origin main
```

### 4. 部署到 GitHub Pages

#### 方法一：通过 GitHub 网页界面
1. 进入你的 GitHub 仓库
2. 点击 Settings 选项卡
3. 在左侧菜单中找到 Pages
4. 在 Source 部分，选择 Deploy from a branch
5. 选择 main 分支和 / (root) 文件夹
6. 点击 Save

#### 方法二：通过 GitHub CLI
```bash
# 启用 GitHub Pages
gh pages create --source main:/ --project safegain-h5
```

### 5. 访问应用

部署完成后，你的应用将在以下地址可用：
```
https://yourusername.github.io/safegain-h5/
```

## 🔧 本地开发

### 安装依赖
项目使用 CDN 加载依赖，无需安装 npm 包。

### 本地运行
```bash
# 使用 Python 启动本地服务器
python -m http.server 8000

# 或使用 Node.js
npx serve .

# 访问 http://localhost:8000
```

## 📱 移动端测试

### 在手机上测试
1. 确保手机和电脑在同一网络
2. 在电脑上运行本地服务器
3. 在手机浏览器中访问：
   ```
   http://your-computer-ip:8000
   ```

### 使用 Chrome DevTools
1. 在 Chrome 中打开应用
2. 按 F12 打开开发者工具
3. 点击设备图标切换到移动端视图
4. 选择不同手机型号进行测试

## 🔒 安全注意事项

### API 密钥管理
- ✅ 使用 `config.example.js` 作为模板
- ✅ 真实配置文件 `config.js` 在 `.gitignore` 中
- ✅ 生产环境考虑使用环境变量
- ❌ 永远不要将真实密钥提交到版本控制

### 数据安全
- 所有数据存储在浏览器的 IndexedDB 中
- 数据仅在本地存储，不会上传到服务器
- 用户清除浏览器数据时会丢失所有记录

## 🐛 常见问题

### Q: API 调用失败
A: 检查 `config.js` 中的 API 密钥和接入点ID是否正确

### Q: 图表显示异常
A: 确保网络连接正常，Chart.js 库已正确加载

### Q: 图片上传失败
A: 检查浏览器权限，确保允许访问相机/相册

### Q: 数据不保存
A: 检查浏览器是否支持 IndexedDB，确保没有使用隐私模式

## 📋 部署检查清单

- [ ] 已创建 `config.js` 文件并填入真实配置
- [ ] `.gitignore` 文件包含 `config.js`
- [ ] 本地测试功能正常
- [ ] 移动端显示正常
- [ ] API 调用正常
- [ ] 数据存储功能正常
- [ ] GitHub Pages 部署成功
- [ ] 生产环境访问正常

## 🔄 更新部署

### 更新代码
```bash
# 添加更改
git add .

# 提交更改
git commit -m "Update: description of changes"

# 推送到 GitHub
git push origin main
```

GitHub Pages 会自动重新部署，通常需要几分钟时间生效。

## 📞 技术支持

如果遇到部署问题，请检查：
1. GitHub Pages 构建日志
2. 浏览器开发者工具控制台
3. 网络请求状态
4. 配置文件格式是否正确