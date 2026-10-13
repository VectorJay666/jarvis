const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**'] },
  // Existing native animation components use mutable shared values and Animated refs.
  // These React Compiler diagnostics do not model the Reanimated/Animated APIs.
  // Standard hook order and dependency checks remain enabled everywhere.
  { files: ['src/agent/GlassActionButton.tsx'], rules: { 'react-hooks/immutability': 'off' } },
  { files: ['src/talk/{BossSkinPicker,Drops,HealthFollow,TalkScreen}.tsx'], rules: { 'react-hooks/refs': 'off' } },
  { files: ['App.tsx', 'src/talk/{HealthFollow,TalkScreen}.tsx'], rules: { 'react-hooks/set-state-in-effect': 'off' } },
]);
