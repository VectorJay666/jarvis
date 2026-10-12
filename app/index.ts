import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

// Skia/metaball 已移除；入口不再加载 canvaskit，避免 Expo Go 解析 Node fs
registerRootComponent(App);
