# Water orb and mobile responsiveness implementation plan

> **For agentic workers:** Implement sequentially in this chat; user authorized direct edits and Expo Go testing.

**Goal:** Restore a translucent water orb and reduce work during input, keyboard opening and Talk → Today navigation.

**Architecture:** Subscribe only input components to a shared draft. Run the orb using a single Reanimated clock and static SVG layers. Disable hidden blur and animation, retain Today rather than mounting it on every switch, and settle measured layout changes once.

**Tech Stack:** Expo 57, React Native 0.86, Reanimated 4.5.1, react-native-svg 15.15.4.

**Spec:** User feedback in this conversation: input focus and Today navigation stall on phone; idle water orb should look and move like water.

## Global constraints
- Preserve current conversations, selected skins, draggable glass sheet, shared navigation indicator and reduced motion.
- Preserve other existing workspace changes; no new native dependency.
- Keep the existing Expo Go LAN service on port 8081 and backend on 9301.
- Browser verification does not establish native device FPS.

### Task 1: Input and layout
- [ ] Create draft store and subscribed home/sheet composer components; remove draft state from AgentScreen.
- [ ] Remove focus-triggered greeting jump; coalesce native layout measurements and avoid Android double keyboard avoidance.
- [ ] Verify send, clearing and synchronization between both inputs.

### Task 2: Water orb
- [ ] Create memoized SVG water orb with UI-thread float, deformation and moving reflections.
- [ ] Pause off-screen, with sheet expanded and while app is backgrounded; respect reduced motion and custom skin.
- [ ] Inspect screenshots and verify idle, typing and pause behaviors.

### Task 3: Navigation
- [ ] Retain Today and one non-home blur target; memoize homepage and stabilize navigation callback.
- [ ] Mount large sheet blur only when visible and expanded, stop hidden animation.
- [ ] Verify repeated and rapid navigation, scroll and existing capsule behavior.

### Task 4: Validation and phone handoff
- [ ] Run TypeScript, lint and browser regressions; verify native bundle compilation and LAN health.
- [ ] Provide connection address and request phone check of focus, idle orb and Today switching.
