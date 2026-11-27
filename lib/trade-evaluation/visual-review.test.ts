import assert from 'node:assert/strict'
import {test} from 'node:test'
import {setupAnnotations,optionTitle} from './visual-review'
import type {OptionPair} from './options'
const reference={kind:'stop' as const,price:1.1995,points:50,atrDistance:1,timeframe:'M3' as const,source:'provisional range boundary' as const,rangeId:'inner' as const,evidenceIds:['e'],from:null,through:null}
const option:OptionPair={id:'x',stopLossPrice:1.1994,takeProfitPrice:1.201,stopReference:reference,targetReference:{...reference,kind:'target',price:1.2011},riskPoints:60,rewardPoints:100,grossRewardRisk:100/60}
test('option labels preserve provisional nested range identity',()=>{
 assert.match(optionTitle(option),/M3.*Inner.*provisional/)
})
test('warning anchors are level-specific and preserve originating timeframe',()=>{
 const a=setupAnnotations(option,1.2,[{code:'SL_INSIDE_NOISE',dimension:'stop',severity:'warning',message:'fixture',evidenceIds:['e'],timeframe:'M15'},{code:'TP_INNER_RANGE_OBSTACLE',dimension:'target',severity:'warning',message:'fixture',evidenceIds:['e'],timeframe:'M3'}])
 assert.equal(a.callouts.find(c=>c.dimension==='stop')?.price,option.stopLossPrice)
 assert.match(a.callouts.find(c=>c.dimension==='stop')!.label,/M15/)
 assert.equal(a.callouts.find(c=>c.dimension==='target')?.price,option.takeProfitPrice)
 assert.equal(a.callouts.length,2)
})
