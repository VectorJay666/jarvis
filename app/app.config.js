/** Local iPhone testing uses app.json; store builds require an online API. */
module.exports = ({ config }) => {
  if (process.env.JARVIS_BUILD_ENV !== 'production') return config;

  const address = process.env.EXPO_PUBLIC_API_BASE;
  let backend;
  try { backend = new URL(address); } catch { /* checked below */ }
  const host = backend?.hostname.toLowerCase().replace(/^\[|\]$/g, '') || '';
  const isLocal = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.') ||
    /^(0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^(::|fc|fd|fe80:)/.test(host);
  if (!backend || backend.protocol !== 'https:' || isLocal || backend.username || backend.password || backend.search || backend.hash) {
    throw new Error('TestFlight 构建需要 EXPO_PUBLIC_API_BASE 指向可公开访问的 HTTPS 后端，不能使用 localhost 或局域网地址。');
  }

  // LAN permission and its HTTP exception are only needed for local testing.
  const infoPlist = { ...config.ios?.infoPlist };
  delete infoPlist.NSLocalNetworkUsageDescription;
  if (infoPlist.NSAppTransportSecurity) {
    const transport = { ...infoPlist.NSAppTransportSecurity };
    delete transport.NSAllowsLocalNetworking;
    if (Object.keys(transport).length) infoPlist.NSAppTransportSecurity = transport;
    else delete infoPlist.NSAppTransportSecurity;
  }
  return { ...config, ios: { ...config.ios, infoPlist } };
};
