/* Jornada de Bia v31.2 — Random Forest local experimental.
 * Uses only local context-learning records. It does not transmit data.
 * Minimum sample threshold is enforced by the caller/model.
 */
(function(global){
  'use strict';
  class JornadaRandomForest {
    constructor(options={}) { this.trees=options.trees||9; this.seed=options.seed||731; this.model=[]; this.labels=[]; }
    random(){ this.seed=(this.seed*1664525+1013904223)>>>0; return this.seed/4294967296; }
    features(key, row){
      const parts=String(key||'').split('|');
      return {time:parts[0]||'?', environment:parts[1]||'?', intent:parts[2]||'?', sequence:parts.slice(3).join('|')||'none', symbols:String(row.seq||'none')};
    }
    train(records){
      const data=[];
      for(const [key,row] of Object.entries(records||{})){
        if(!row||typeof row!=='object'||!row.text) continue;
        const weight=Math.max(1,Math.min(8,Number(row.count)||1));
        for(let i=0;i<weight;i++) data.push({x:this.features(key,row), y:String(row.text)});
      }
      this.model=[]; this.labels=[...new Set(data.map(d=>d.y))];
      if(data.length<5||this.labels.length<2) return {ready:false,samples:data.length,classes:this.labels.length};
      for(let t=0;t<this.trees;t++){
        const sample=[]; for(let i=0;i<data.length;i++) sample.push(data[Math.floor(this.random()*data.length)]);
        this.model.push(this.buildTree(sample,0));
      }
      return {ready:true,samples:data.length,classes:this.labels.length};
    }
    buildTree(rows,depth){
      const counts={}; rows.forEach(r=>counts[r.y]=(counts[r.y]||0)+1);
      const majority=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
      if(depth>=4||Object.keys(counts).length===1||rows.length<4) return {label:majority};
      const keys=['time','environment','intent','sequence','symbols']; let best=null,bestScore=Infinity;
      for(const feature of keys){
        const groups={}; rows.forEach(r=>{const v=r.x[feature]||'?';(groups[v]||(groups[v]=[])).push(r);});
        if(Object.keys(groups).length<2) continue;
        let score=0; for(const group of Object.values(groups)){const c={};group.forEach(r=>c[r.y]=(c[r.y]||0)+1);let g=0;for(const n of Object.values(c))g-=(n/group.length)*Math.log2(n/group.length);score+=group.length/rows.length*g;}
        if(score<bestScore){bestScore=score;best={feature,groups};}
      }
      if(!best) return {label:majority};
      const branches={}; for(const [value,group] of Object.entries(best.groups)) branches[value]=this.buildTree(group,depth+1);
      return {feature:best.feature,branches,label:majority};
    }
    predict(key,row={}){
      if(!this.model.length) return null;
      const x=this.features(key,row), votes={};
      for(const tree of this.model){let node=tree;while(node&&node.feature){node=node.branches[x[node.feature]]||{label:node.label};}if(node&&node.label)votes[node.label]=(votes[node.label]||0)+1;}
      const ranked=Object.entries(votes).sort((a,b)=>b[1]-a[1]);
      return ranked.length?{text:ranked[0][0],confidence:ranked[0][1]/this.model.length,trees:this.model.length}:null;
    }
  }
  global.JornadaRandomForest=JornadaRandomForest;
})(window);
