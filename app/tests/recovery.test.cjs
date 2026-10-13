const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/recovery/demo.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', js)(loaded, loaded.exports);
const { seedConversation, advanceDemo } = loaded.exports;
const send = (state, value) => advanceDemo(state, value);

test('早晨多轮保留工作量与不能午睡的约束，明确模拟日历', () => {
 let state = send(seedConversation('morning'), '读取我的日程');
 assert.match(state.current.cards[0].title, /模拟日历/);
 state = send(state, '报告还要两小时，中午不能午睡');
 assert.match(state.current.cards[0].rows.map(r=>r.value).join(' '), /不安排午睡/);
 assert.equal(state.messages.length, 5);
 state = send(state, '本来想跑间歇，帮我傍晚提醒再决定');
 assert.ok(state.current.reminder_request);
 state = send(state, '下午五点');
 assert.match(state.current.reply, /演示提醒.*17:00/);
 assert.equal(state.current.reminder_request, null);
 state = send(state, '取消这个提醒');
 assert.match(state.current.reply, /已取消.*没有发送真实通知/);
});
test('傍晚任务延期更新建议，不能把截止时间视为完成', () => {
 let state=send(seedConversation('evening'),'仍然很困，报告还没交');
 assert.match(state.current.reply,/剩多少工作/);
 state=send(state,'截止改到九点，还剩一小时，先写报告');
 assert.match(state.current.reply,/间歇跑.*移出/);
 assert.match(state.current.cards[0].rows.map(r=>r.value).join(' '),/21:00/);
});
test('晚上已给出明确提醒时间时不重复询问，取消演示无真实工具操作', () => {
 let state=send(seedConversation('night'),'先放松一会儿，今晚想十一点睡');
 state=send(state,'十点半提醒我洗漱');
 assert.match(state.current.reply,/22:30/);
 assert.equal(state.current.reminder_request,null);
});
test('自由输入未覆盖时如实说明演示范围，不伪装理解能力', () => {
 const state=send(seedConversation('morning'),'给我解释量子物理');
 assert.match(state.current.reply,/预设交互演示/);
 assert.equal(state.messages[1].content,'给我解释量子物理');
});

const streamSource = fs.readFileSync(path.join(__dirname, '../src/recovery/stream.ts'), 'utf8');
const streamModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(streamSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(streamModule, streamModule.exports);
test('流式协议跨字符分块保留回复与最终结构，接受无末尾换行', () => {
 const events = []; const decoder = streamModule.exports.createEventDecoder(event => events.push(event));
 const output = {reply:'你好', cards:[], quick_replies:[], reminder_request:null};
 const text = JSON.stringify({type:'reply',text:'你好'}) + '\n' + JSON.stringify({type:'complete',result:output});
 for(const character of text) decoder.push(character); decoder.finish();
 assert.equal(events[0].text,'你好'); assert.deepEqual(events[1].result,output);
});
test('错误流与未知协议不能当成正常回复', () => {
 const decoder = streamModule.exports.createEventDecoder(event => { if(event.type==='error') throw Error(event.message); });
 assert.throws(()=>decoder.push('{"type":"error","message":"连接中断"}\n'),/连接中断/);
 const malformed = streamModule.exports.createEventDecoder(()=>{});
 assert.throws(()=>malformed.push('{"type":"complete","result":{"reply":"half"}}\n'));
 assert.throws(()=>streamModule.exports.createEventDecoder(()=>{}).push('{"type":"unknown"}\n'));
});
