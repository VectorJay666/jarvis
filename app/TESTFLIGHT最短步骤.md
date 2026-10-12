# 真机 / TestFlight 最短步骤

盒子只做 Web 预览，**不能签名**。以下在用户 **Mac** 上执行。

## 开发真机

1. 装好 Xcode、Node 20+、CocoaPods；有 Apple ID。
2. `cd app && npm i`
3. `npx expo start` → 手机 Expo Go 扫码  
   或 `npx expo run:ios`（模拟器/USB 真机）
4. 联调 Backend：`EXPO_PUBLIC_API_BASE=http://<Mac局域网IP>:9301`  
   （真机不要用 `127.0.0.1`）

## TestFlight

1. `npx eas-cli@latest build -p ios --profile preview`  
   （正式发版用 `--profile production`）
2. `npx eas-cli@latest submit -p ios`
3. App Store Connect → TestFlight → 加测试员 → 安装

## Android（可选后置）

`npm run android` 或后续 `eas build -p android`。工程未锁死 iOS-only。
