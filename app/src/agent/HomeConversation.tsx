import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Tap } from '../talk/press';
import { ConversationOrb, FlowSurface, FlowText, type GlassTarget } from '../recovery/ConversationMotion';
import type { Message } from '../recovery/types';
import type { AssistantReply } from '../recovery/client';
import { FloatingChoices } from '../recovery/FloatingChoices';
const TOPICS = { general: '一起聊聊', sleep: '睡眠与恢复', fitness: '运动与训练', diet: '饮食安排', budget: '预算与开销' };
export function HomeConversation({ messages, result, busy, pending, error, onRetry, onReset }: { messages: Message[]; result: AssistantReply | null; busy: boolean; pending: string; error: string; onRetry: () => void; onReset: () => void }) {
  return <View testID="home-conversation" style={s.conversation}>
    <View style={s.heading}><Text style={s.topic} testID="home-conversation-topic">{TOPICS[result?.topic || 'general']}</Text><Tap onPress={onReset} disabled={busy} accessibilityLabel="结束这次首页对话" style={s.reset}><Ionicons name="close" size={18} color="#86868B" /></Tap></View>
    {messages.map(message => <FlowSurface key={message.id} style={message.role === 'user' ? s.user : s.reply}><Text style={message.role === 'user' ? s.userText : s.text}>{message.content}</Text></FlowSurface>)}
    {busy ? <FlowSurface style={s.reply} testID="home-conversation-pending"><View style={s.status}><ConversationOrb active /><Text style={s.meta}>{pending ? '正在回复' : '在听，也在想…'}</Text></View>{pending ? <FlowText text={pending} streaming style={s.text} /> : null}</FlowSurface> : null}
    {!busy && result?.cards.map((card, index) => <FlowSurface key={`${messages.length}-${index}`} delay={index * 70} style={s.card}><Text style={s.cardTitle}>{card.title}</Text>{card.rows.map((row,i) => <View key={i} style={s.row}><Text style={s.meta}>{row.label}</Text><Text style={s.value}>{row.value}</Text></View>)}<Text style={s.meta}>{card.basis}</Text></FlowSurface>)}
    {error ? <View style={s.card} testID="home-conversation-error"><Text style={s.meta}>{error}</Text><Tap onPress={onRetry} style={s.retry} testID="home-conversation-retry"><Text style={s.userText}>重试这条消息</Text></Tap></View> : null}
  </View>;
}
export function HomeComposer({ input, busy, onChange, onSend, onStop, choices, onChoose, blurTarget }: { input: string; busy: boolean; onChange: (text:string)=>void; onSend:()=>void; onStop:()=>void; choices: string[]; onChoose: (value: string) => void; blurTarget?: GlassTarget }) {
  return <View style={s.dock} testID="home-conversation-dock">
    <FloatingChoices choices={busy ? [] : choices} onChoose={onChoose} disabled={busy} testIDPrefix="home-quick" blurTarget={blurTarget} />
    <FlowSurface style={s.composer} blurTarget={blurTarget} animate={false}><ConversationOrb active={busy} input={input} /><TextInput testID="home-conversation-input" value={input} onChangeText={onChange} editable={!busy} style={s.input} placeholder="也可以说说你的想法…" placeholderTextColor="#86868B" maxLength={2000} returnKeyType="send" onSubmitEditing={onSend} /><Tap style={[s.send, !busy && !input.trim() && { opacity: 0.2 }]} disabled={!busy && !input.trim()} onPress={busy ? onStop : onSend} testID="home-conversation-send" accessibilityLabel={busy ? '停止回复' : '发送'}><Ionicons name={busy ? 'stop' : 'arrow-up'} size={busy ? 14 : 19} color="#FFF" /></Tap></FlowSurface>
  </View>;
}
const s=StyleSheet.create({ conversation:{gap:16,paddingBottom:20},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},topic:{fontSize:13,color:'#86868B'},reset:{width:44,height:44,alignItems:'center',justifyContent:'center'},user:{alignSelf:'flex-end',maxWidth:'92%',backgroundColor:'rgba(227,236,228,0.42)',padding:14,borderRadius:20,borderBottomRightRadius:5},userText:{fontSize:14,lineHeight:22,color:'#1D1D1F'},reply:{gap:5,padding:17,borderBottomLeftRadius:7},text:{fontSize:16,lineHeight:27,color:'#1D1D1F'},status:{flexDirection:'row',alignItems:'center'},meta:{fontSize:12,lineHeight:20,color:'#86868B'},card:{backgroundColor:'rgba(255,255,255,0.26)',padding:18,borderRadius:22,gap:12,borderWidth:0.5,borderColor:'#FFFFFF'},cardTitle:{fontSize:16,fontWeight:'600',color:'#1D1D1F'},row:{flexDirection:'row',gap:14},value:{flex:1,fontSize:14,lineHeight:22,color:'#1D1D1F'},retry:{minHeight:44,justifyContent:'center'},dock:{marginHorizontal:18,marginTop:10,marginBottom:4},composer:{flexDirection:'row',alignItems:'center',padding:5,paddingLeft:3,borderRadius:30,backgroundColor:'rgba(255,255,255,0.26)',borderWidth:0.5,borderColor:'#FFFFFF',minHeight:54},input:{flex:1,minWidth:0,minHeight:44,fontSize:14,color:'#1D1D1F'},send:{width:42,height:42,borderRadius:24,backgroundColor:'#1D1D1F',alignItems:'center',justifyContent:'center'}});
