import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {rotationFrameIssue,rotationViews} from '../lib/product-rotation.ts';
async function silhouette(ratio, colour='#c28a45') {
 const w=400,h=Math.round(w*ratio);
 return sharp({create:{width:w,height:h,channels:4,background:colour}}).extend({left:100,right:100,top:100,bottom:100,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
}
test('a repeated overhead view cannot pass an edge or oblique frame',async()=>{
 const overhead=await silhouette(1);
 assert.equal(await rotationFrameIssue(overhead,1),null);
 for(const index of [0,2,3,4,6,7,8]) assert.match(await rotationFrameIssue(overhead,index),/wrong silhouette/);
});
test('the full orbit requires top, thin edges, underside and foreshortened angles',async()=>{
 assert.equal(rotationViews.length,9);
 for(let i=0;i<rotationViews.length;i++) {
  const view=rotationViews[i];
  assert.equal(await rotationFrameIssue(await silhouette((view.minRatio+view.maxRatio)/2),i),null);
 }
});
test('duplicate frames are rejected even when the silhouette is appropriate',async()=>{
 const image=await silhouette(.6);
 assert.match(await rotationFrameIssue(image,2,[image]),/repeats/);
});
