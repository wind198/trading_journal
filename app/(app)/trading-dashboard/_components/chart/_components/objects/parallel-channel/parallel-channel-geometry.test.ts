import assert from 'node:assert/strict'
import test from 'node:test'
import {channelSegments,moveChannel,validChannelBaseline,type ChannelPoints} from './parallel-channel-geometry'
test('two parallel equal-length lines pass through baseline and width anchor',()=>{const s=channelSegments({x:10,y:20},{x:30,y:10},{x:20,y:30});assert.deepEqual(s,[[{x:10,y:20},{x:30,y:10}],[{x:10,y:35},{x:30,y:25}]])})
test('vertical baseline rejected',()=>{assert.equal(channelSegments({x:10,y:20},{x:10,y:10},{x:20,y:30}),null);assert.equal(validChannelBaseline({time:10,price:1},{time:10.1,price:2}),false)})
test('translation preserves all anchors',()=>{const p:ChannelPoints=[{time:10,price:1},{time:20,price:2},{time:20,price:3}];assert.deepEqual(moveChannel(p,-1,{time:10,price:1},{time:12,price:2}),[{time:12,price:2},{time:22,price:3},{time:22,price:4}])})
