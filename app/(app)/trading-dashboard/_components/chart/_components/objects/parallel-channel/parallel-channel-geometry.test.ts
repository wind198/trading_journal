import assert from 'node:assert/strict'
import { test } from 'node:test'
import { channelGeometry, moveChannel, type ChannelPoints } from './parallel-channel-geometry'
const points:ChannelPoints=[{time:10,price:100},{time:20,price:110},{time:15,price:112}]
test('parallel boundaries and midpoint preserve slope with signed price offset',()=>{const g=channelGeometry(points)!;assert.equal(g.offset,7);assert.deepEqual(g.opposite,[{time:10,price:107},{time:20,price:117}]);assert.deepEqual(g.middle,[{time:10,price:103.5},{time:20,price:113.5}])})
test('negative width and reverse time are supported',()=>{assert.equal(channelGeometry([points[1],points[0],{time:15,price:99}])?.offset,-6)})
test('equal time baseline is invalid',()=>{assert.equal(channelGeometry([points[0],points[0],points[2]]),null)})
test('body translation preserves width and slope; invalid anchor move is ignored',()=>{const moved=moveChannel(points,-1,{time:1,price:1},{time:4,price:6});assert.equal(channelGeometry(moved)?.offset,7);assert.deepEqual(moved[0],{time:13,price:105});assert.equal(moveChannel(points,1,points[1],points[0]),points)})
