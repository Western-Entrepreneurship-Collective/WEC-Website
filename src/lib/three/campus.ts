import * as T from 'three';
import { siteContent } from '@/data/siteContent';

const materials = () => ({
  stone: new T.MeshStandardMaterial({ color: '#eae8ec', roughness: .92 }),
  trim: new T.MeshStandardMaterial({ color: '#fcfbfd', roughness: .76 }),
  dark: new T.MeshStandardMaterial({ color: '#45384f', roughness: .82 }),
  glass: new T.MeshStandardMaterial({ color: '#b4c7c3', metalness: .1, roughness: .35, emissive: '#5e766c', emissiveIntensity: .12 }),
  glassLight: new T.MeshStandardMaterial({ color: '#dce5df', roughness: .42, metalness: .08 }),
  glassDeep: new T.MeshStandardMaterial({ color: '#819d93', roughness: .38, metalness: .1 }),
  wood: new T.MeshStandardMaterial({ color: '#c9bba5', roughness: .88 }),
  green: new T.MeshStandardMaterial({ color: '#708a70', roughness: 1 }),
  purple: new T.MeshStandardMaterial({ color: '#806396', roughness: .9 }),
  floor: new T.MeshStandardMaterial({ color: '#efedf0', roughness: 1 }),
  sage: new T.MeshStandardMaterial({ color: '#a3b69a', roughness: 1 }),
  olive: new T.MeshStandardMaterial({ color: '#819976', roughness: 1 }),
  heather: new T.MeshStandardMaterial({ color: '#b0a4b5', roughness: 1 }),
  moss: new T.MeshStandardMaterial({ color: '#bac5a9', roughness: 1 }),
  grass: new T.MeshStandardMaterial({ color: '#e4e8df', roughness: 1 }),
  forest: new T.MeshStandardMaterial({ color: '#4d7566', roughness: 1 }),
  rug: new T.MeshStandardMaterial({ color: '#d6dfd5', roughness: 1 }),
});
type Palette = ReturnType<typeof materials>;
function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) {
  const object = new T.Mesh(geometry, material); object.position.set(x,y,z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function box(p: T.Object3D, m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) { return mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z); }
function ball(p: T.Object3D, m: T.Material, x: number, y: number, z: number, r: number, sx=1, sy=1, sz=1) { const o=mesh(p,new T.SphereGeometry(r,8,6),m,x,y,z); o.scale.set(sx,sy,sz); return o; }
function rod(p: T.Object3D, m: T.Material, a: number[], b: number[], r: number) {
  const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from);
  const o=mesh(p,new T.CylinderGeometry(r,r,delta.length(),6),m,...from.clone().add(to).multiplyScalar(.5).toArray()); o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()); return o;
}
function label(p: T.Object3D, text: string, x:number,y:number,z:number,w:number,h:number, color='#582c83', background='#f7f5ef', handwritten=false) {
  const canvas=document.createElement('canvas'); canvas.width=1024;canvas.height=Math.max(1,Math.round(1024*h/w));const c=canvas.getContext('2d')!;
  if(!handwritten){c.fillStyle=background;c.fillRect(0,0,1024,canvas.height);}
  c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';const lines=text.split('\n');
  const size=Math.round(canvas.height*(handwritten?(lines.length>1?.52:.8):(lines.length>1?.36:.52)));
  c.font=`600 ${size}px ${handwritten?'"Caveat", cursive':'Arial'}`;
  lines.forEach((line,i)=>{
    c.save();c.translate(512,canvas.height*(.48+(i-(lines.length-1)/2)*(handwritten?.46:.4)));c.rotate(handwritten?(i%2?.012:-.012):0);
    // Preserve the natural proportions of the lettering instead of squeezing it.
    const scale=Math.min(1,930/c.measureText(line).width);c.scale(scale,scale);c.fillText(line,0,0);c.restore();
  });
  if(handwritten){c.strokeStyle='#582c8338';c.lineWidth=2.5;c.lineCap='round';c.beginPath();c.moveTo(190,canvas.height*.91);c.bezierCurveTo(370,canvas.height*.88,650,canvas.height*.94,820,canvas.height*.9);c.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const o=mesh(p,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false,transparent:handwritten,depthWrite:!handwritten}),x,y,z);o.castShadow=false;return o;
}
function foliage(p:T.Object3D,material:T.Material,x:number,y:number,z:number,size:number,seed=0) {
  const geometry=new T.IcosahedronGeometry(1,2);const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){const v=new T.Vector3().fromBufferAttribute(positions,i);const swell=1+.06*Math.sin(v.x*13+v.y*9+v.z*17+seed);v.multiplyScalar(swell);positions.setXYZ(i,v.x,v.y,v.z);}
  // Keep the radial normals smooth; recomputing non-indexed normals makes rocky facets.
  const colours:number[]=[];
  for(let i=0;i<positions.count;i++){const v=new T.Vector3().fromBufferAttribute(positions,i);const light=.9+.07*Math.sin(v.x*8+v.z*7+seed)+.035*v.y;colours.push(light,light,light);}
  geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  const leafMaterial=(material as T.MeshStandardMaterial).clone();leafMaterial.vertexColors=true;
  const crown=mesh(p,geometry,leafMaterial,x,y,z);crown.scale.set(size,size*.88,size*.9);return crown;
}
function autumnTree(p:T.Object3D,m:Palette,x:number,z:number,size=1,tone=0) {
  const tree=new T.Group();tree.position.set(x,0,z);tree.scale.setScalar(size);p.add(tree);
  const bark=new T.MeshStandardMaterial({color:'#756353',roughness:1});
  rod(tree,bark,[0,0,0],[.12,4.5,0],.14);
  const shades=tone%3===0?[m.sage,m.olive,m.sage]:tone%3===1?[m.heather,m.olive,m.sage]:[m.moss,m.sage,m.olive];
  for(let i=0;i<9;i++){
    const angle=i*2.4;const spread=i<6?1.35:.65;const px=Math.cos(angle)*spread,pz=Math.sin(angle)*spread,py=3.2+(i%3)*.8;
    rod(tree,bark,[.04,1.8+(i%3)*.35,0],[px,py,pz],.055);
    foliage(tree,shades[i%3],px,py+.3,pz,1.15+(i%2)*.2,i+tone);
    foliage(tree,shades[(i+1)%3],px+.5*Math.cos(angle+.8),py+.85,pz+.35, .63,i+3);
  }
  foliage(tree,shades[0],0,5.25,0,1.25,4);
  const shade=mesh(tree,new T.CircleGeometry(2.25,32),new T.MeshBasicMaterial({color:'#567a60',transparent:true,opacity:.12,depthWrite:false}),0,.025,0);shade.rotation.x=-Math.PI/2;
}
function plant(p:T.Object3D,m:Palette,x:number,z:number,size=1) {
  mesh(p,new T.CylinderGeometry(.4,.29,.6,12),m.trim,x,.3,z);
  rod(p,m.wood,[x,.5,z],[x,2.1*size,z],.045);
  for(let j=0;j<5;j++){const a=j*2.4;foliage(p,j%2?m.sage:m.moss,x+Math.cos(a)*.28*size,1.2*size+j*.19*size,z+Math.sin(a)*.25*size,.4*size,j);}
}
function seatedPerson(p:T.Object3D,m:Palette,index:number,x:number,z:number,angle:number) {
  const group=new T.Group();group.position.set(x,0,z);group.rotation.y=angle;p.add(group);
  const shirt=new T.MeshStandardMaterial({color:['#77618b','#d3caba','#718575','#adbcb0','#a695b3','#d4c9bd'][index],roughness:.9});
  const skin=new T.MeshStandardMaterial({color:['#bf8a67','#edc7a7','#825537','#dba780','#a66d4b','#e1b89c'][index],roughness:1});
  const hair=new T.MeshStandardMaterial({color:['#352a29','#4e3428','#252428','#825c3e','#28252b','#433326'][index],roughness:1});
  const trousers=new T.MeshStandardMaterial({color:index%2?'#48515d':'#373342',roughness:1});
  // Chair shell, upholstery, four legs and a visible curved back.
  box(group,m.wood,0,.82,0,.9,.13,.88);box(group,m.forest,0,.91,0,.78,.1,.74);
  box(group,m.wood,0,1.25,-.42,.86,.65,.11);box(group,m.forest,0,1.27,-.35,.72,.48,.08);
  for(const xx of [-.34,.34])for(const zz of [-.31,.31])rod(group,m.dark,[xx,.78,zz],[xx*1.18,.06,zz*1.18],.035);
  ball(group,shirt,0,1.42,-.02,.43,.95,1.25,.65);
  mesh(group,new T.CylinderGeometry(.1,.13,.2,12),skin,0,1.91,0);
  ball(group,skin,0,2.18,.02,.27,.85,1.13,.92);ball(group,hair,0,2.34,-.04,.255,1, .65,1);
  if(index%3===0)ball(group,hair,0,2.29,-.23,.18,1,1.4,1);
  for(const xx of [-.245,.245]) {
    rod(group,trousers,[xx,1.02,.02],[xx,.88,.61],.145);rod(group,trousers,[xx,.88,.61],[xx,.19,.66],.11);
    ball(group,m.dark,xx,.11,.78,.16,.8,.5,1.5);
    const sign=Math.sign(xx);rod(group,shirt,[sign*.34,1.68,0],[sign*.5,1.25,.27],.105);rod(group,skin,[sign*.5,1.25,.27],[sign*.3,1.32,.63],.075);ball(group,skin,sign*.3,1.32,.65,.09);
    ball(group,skin,sign*.25,2.17,.015,.063,.6,1,1);
  }
  ball(group,skin,0,2.18,.26,.045,.7,1,1.2);
  for(const xx of [-.085,.085])ball(group,m.dark,xx,2.24,.25,.022);
  if(index===4)for(const xx of [-.09,.09]) {const ring=mesh(group,new T.TorusGeometry(.071,.009,6,16),m.dark,xx,2.24,.27);ring.castShadow=false;}
  return group;
}

function classroom(m:Palette) {
  const room=new T.Group();
  box(room,m.floor,0,-.12,0,13,.24,10);
  // A pale oak-and-sage studio opens straight onto the garden; the front stays clear.
  box(room,m.trim,0,2.1,-5,13,4.2,.18);
  box(room,m.trim,-6.5,.4,0,.18,.8,10);box(room,m.trim,-6.5,4,0,.2,.4,10);
  box(room,m.wood,0,.12,-4.86,13,.18,.1);box(room,m.wood,-6.36,.8,0,.3,.12,10);
  for(let i=-6;i<7;i++)box(room,m.stone,i,.008,0,.012,.012,10);
  for(let i=-4;i<5;i++)box(room,m.stone,0,.009,i,13,.012,.012);
  // Tall window bays and muted foliage belong to the shared interior model.
  for(const z of [-3.2,0,3.2]){
    box(room,m.glassLight,-6.48,2.35,z,.05,2.9,3.05);
    for(const zz of [-1.5,0,1.5])box(room,zz===0?m.dark:m.trim,-6.32,2.35,z+zz,.14,3.05,zz===0?.055:.16);
    box(room,m.trim,-6.31,2.35,z,.16,.12,3.05);
    box(room,m.dark,-6.3,1.65,z,.04,.025,2.94);
    // Shallow branches and foliage silhouettes read as a garden beyond the glass.
    rod(room,m.wood,[-6.38,.95,z+.35],[-6.38,2.6,z],.035);
    for(let j=0;j<4;j++){const crown=foliage(room,j%2?m.sage:m.olive,-6.36,1.7+j*.26,z-.6+j*.32,.37,j);crown.scale.x=.08;}
  }
  // Warm writing wall, pinboard and a green credenza replace the grey classroom.
  box(room,m.wood,0,2.48,-4.8,5.3,2.05,.14);box(room,m.trim,0,2.48,-4.69,5.12,1.87,.06);
  label(room,'You can start here.',0,2.85,-4.64,4.35,.62,'#45384f','#fcfbfd',true);
  for(let i=0;i<6;i++)box(room,[m.sage,m.glassLight,m.heather][i%3],-1.6+i*.63,2.18,-4.62,.38,.32,.016);
  box(room,m.wood,0,1.44,-4.58,5.45,.055,.25);
  box(room,m.wood,-4.45,2.5,-4.8,2.25,1.8,.12);
  for(let i=0;i<3;i++){const sheet=box(room,m.trim,-5+i*.52,2.65-(i%2)*.45,-4.7,.43,.63,.025);sheet.rotation.z=(i-1)*.08;}
  box(room,m.forest,4.65,.69,-4.3,2.8,1.38,.9);box(room,m.wood,4.65,1.42,-4.3,2.95,.12,1.04);
  for(let i=0;i<3;i++){box(room,m.glassLight,3.76+i*.9,.7,-3.82,.84,1.18,.025);box(room,m.wood,3.76+i*.9,.82,-3.77,.28,.04,.04);}
  for(let i=0;i<7;i++)box(room,[m.sage,m.forest,m.trim][i%3],3.55+i*.18,1.69,-4.26,.12,.4+(i%2)*.12,.36);
  plant(room,m,5.4,-4.3,.63);
  const clock=mesh(room,new T.CylinderGeometry(.4,.4,.08,32),m.wood,4.7,3.15,-4.78);clock.rotation.x=Math.PI/2;
  const face=mesh(room,new T.CircleGeometry(.34,32),m.trim,4.7,3.15,-4.72);
  face.castShadow=false;rod(room,m.dark,[4.7,3.15,-4.7],[4.7,3.4,-4.7],.018);rod(room,m.dark,[4.7,3.15,-4.7],[4.9,3.06,-4.7],.018);
  plant(room,m,5.25,2.8,.8);
  const rug=mesh(room,new T.CylinderGeometry(3.55,3.55,.016,64),m.rug,0,.018,0);rug.scale.z=1.2;
  const rugEdge=mesh(room,new T.TorusGeometry(3.46,.018,4,64),m.trim,0,.03,0);rugEdge.rotation.x=Math.PI/2;rugEdge.scale.y=1.2;
  const table=mesh(room,new T.CylinderGeometry(2.15,2.15,.16,40),m.wood,0,1.17,0);table.scale.z=1.2;
  const top=mesh(room,new T.CylinderGeometry(2.11,2.11,.045,40),m.wood,0,1.27,0);top.scale.z=1.2;
  for(const z of [-1.2,1.2]){mesh(room,new T.CylinderGeometry(.17,.23,1.1,12),m.forest,0,.57,z);box(room,m.forest,0,.08,z,1.4,.09,.65);}
  const people:T.Group[]=[];
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3+Math.PI/6;const x=Math.sin(a)*2.7,z=Math.cos(a)*3.2;
    people.push(seatedPerson(room,m,i,x,z,a+Math.PI));
    const objects=new T.Group();objects.position.set(Math.sin(a)*1.5,1.31,Math.cos(a)*1.85);objects.rotation.y=a;room.add(objects);
    if(i%2===0){box(objects,m.dark,0,.025,0,.65,.04,.44);const screen=box(objects,m.dark,0,.25,-.18,.65,.44,.035);screen.rotation.x=-.22;const glow=box(objects,m.glass,0,.25,-.153,.56,.34,.015);glow.rotation.x=-.22;}
    else {box(objects,i===1?m.purple:m.green,0,.025,0,.48,.05,.61);box(objects,m.trim,0,.055,0,.43,.016,.55);rod(objects,m.dark,[-.12,.08,.18],[.14,.08,-.16],.013);}
    mesh(objects,new T.CylinderGeometry(.085,.07,.19,16),m.stone,.42,.095,.04);
    const handle=mesh(objects,new T.TorusGeometry(.063,.018,6,12),m.stone,.51,.1,.04);handle.rotation.y=Math.PI/2;
  }
  return {room,people};
}

function campus(m:Palette) {
  const outside=new T.Group();const building=new T.Group();outside.add(building);
  // Stepped volumes and a continuous sage-grey curtain wall reinterpret the reference.
  const wing=(x:number,width:number,floors:number,front:number,depth:number)=>{
    const h=floors*2.8;
    box(building,m.glassDeep,x,h/2,front-.1,width,h,.2);
    box(building,m.glass,x+(x<0?-1:1)*width/2,h/2,front-depth/2,.12,h,depth);
    for(let floor=0;floor<floors;floor++){
      const y=1.4+floor*2.8;
      for(let bay=0;bay<4;bay++){
        const xx=x-width/2+(bay+.5)*width/4;
        box(building,[m.glassDeep,m.glass,m.glassLight][Math.min(2,Math.floor((floor+bay%2)/2))],xx,y,front+.025,width/4-.16,2.5,.045);
        box(building,m.dark,xx,y,front+.07,.035,2.5,.06);
        box(building,m.dark,xx,y-.1,front+.07,width/4-.14,.035,.06);
      }
      for(let bay=0;bay<4;bay++){
        const zz=front-(bay+.5)*depth/4,side=x+(x<0?-1:1)*(width/2+.06);
        box(building,floor%2?m.glassLight:m.glass,side,y,zz,.035,2.5,depth/4-.16);
        box(building,m.dark,side+(x<0?-.03:.03),y,zz,.035,2.5,.045);
      }
    }
    for(let i=0;i<=floors;i++){
      box(building,m.trim,x,i*2.8,front+.12,width+.22,.2,.28);
      box(building,m.trim,x+(x<0?-1:1)*(width/2+.06),i*2.8,front-depth/2,.28,.2,depth+.2);
    }
    for(let i=0;i<=4;i++)box(building,m.trim,x-width/2+i*width/4,h/2,front+.13,.17,h,.28);
    for(let i=0;i<=4;i++)box(building,m.trim,x+(x<0?-1:1)*(width/2+.06),h/2,front-i*depth/4,.28,h,.17);
    box(building,m.trim,x,h+.2,front-depth/2,width+.45,.3,depth+.4);
    box(building,m.stone,x,h+.42,front-depth/2,width-.35,.13,depth-.4);
    // Thin reflected sky streaks on the upper glazing, behind the mullions.
    const sheen=new T.MeshBasicMaterial({color:'#e8fbf3',transparent:true,opacity:.14,depthWrite:false});
    for(let i=0;i<3;i++){const glint=box(building,sheen,x-width*.28+i*.7,h*.64,front+.078,.11,h*.28,.005);glint.rotation.z=-.22;}
  };
  wing(-5.15,6.8,3,-7.05,9.5);wing(5.15,6.8,4,-7.55,10.5);
  // A recessed central lantern and an oak-lined canopy mark the entrance.
  box(building,m.glass,0,7.1,-7.18,3.5,7.4,.15);
  for(const x of [-1.75,0,1.75])box(building,m.trim,x,7.1,-7.03,.16,7.4,.23);
  for(const y of [4.2,5.6,8.4,11.2])box(building,m.trim,0,y,-7.02,3.6,.18,.24);
  box(building,m.trim,0,11.42,-10.5,3.85,.25,7);
  box(building,m.trim,0,3.6,-6.1,5.35,.22,2.35);
  for(let i=0;i<12;i++)box(building,m.wood,-2.4+i*.44,3.45,-6.1,.16,.06,2.05);
  for(const x of [-2.45,2.45])box(building,m.trim,x,1.72,-5.4,.15,3.44,.15);
  // A planted terrace gives the lower volume a distinct silhouette.
  box(building,m.trim,-5.2,8.82,-10.5,5.3,.65,1.15);
  for(let i=0;i<7;i++)foliage(building,i%2?m.sage:m.moss,-7.4+i*.73,9.15,-10.5,.5,i);
  // One raised plaque sits fully in front of the facade and window mullions.
  box(building,m.trim,0,4.27,-6.26,6.3,.95,.18);
  const plaque=document.createElement('canvas');plaque.width=1536;plaque.height=240;
  const lettering=plaque.getContext('2d')!;lettering.fillStyle='#45384f';lettering.textAlign='center';lettering.textBaseline='middle';
  lettering.font='600 142px "Space Grotesk Variable", sans-serif';lettering.fillText('MORRISSETTE',768,91);
  lettering.font='500 42px "Space Grotesk Variable", sans-serif';lettering.fillText('INSTITUTE FOR ENTREPRENEURSHIP',768,200);
  const plaqueTexture=new T.CanvasTexture(plaque);plaqueTexture.colorSpace=T.SRGBColorSpace;
  const plaqueFace=mesh(building,new T.PlaneGeometry(5.9,.921875),new T.MeshBasicMaterial({map:plaqueTexture,transparent:true,toneMapped:false}),0,4.27,-6.154);plaqueFace.castShadow=false;
  for(let i=0;i<3;i++)box(building,m.stone,0,.06+i*.065,-5.9+i*.32,5.5-i*.2,.12,.95);
  const doors:T.Group[]=[];
  for(const side of [-1,1]) {
    const hinge=new T.Group();hinge.position.set(side*1.62,0,-6.76);building.add(hinge);doors.push(hinge);
    const center=-side*.8;box(hinge,m.dark,center,1.66,0,1.6,3.32,.12);box(hinge,m.glass,center,1.74,.075,1.4,2.98,.045);
    for(const y of [.22,1,3.2])box(hinge,m.dark,center,y,.12,1.5,.06,.09);
    rod(hinge,m.wood,[center-side*.55,1.12,.23],[center-side*.55,1.95,.23],.04);
    for(const y of [1.13,1.94])rod(hinge,m.wood,[center-side*.55,y,.1],[center-side*.55,y,.23],.025);
  }
  const curve=new T.CatmullRomCurve3([new T.Vector3(7,.04,34),new T.Vector3(-6,.04,24),new T.Vector3(-5,.04,17),new T.Vector3(5,.04,10),new T.Vector3(3,.04,3),new T.Vector3(0,.04,-5.4)]);
  const vertices:number[]=[],indices:number[]=[];const edges:T.Vector3[][]=[[],[]];
  for(let i=0;i<=180;i++){const t=i/180,p=curve.getPoint(t),v=curve.getTangent(t),n=new T.Vector3(-v.z,0,v.x).normalize();for(const side of [-1,1]){const edge=p.clone().addScaledVector(n,1.15*side);vertices.push(...edge.toArray());edges[side<0?0:1].push(edge);}if(i<180){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const paving=new T.MeshStandardMaterial({color:'#eeece9',roughness:1,side:T.DoubleSide});mesh(outside,geometry,paving,0,0,0);
  for(const edge of edges)mesh(outside,new T.TubeGeometry(new T.CatmullRomCurve3(edge),180,.045,6,false),m.trim,0,.02,0);
  for(let i=1;i<33;i++){const t=i/33,p=curve.getPoint(t),v=curve.getTangent(t),n=new T.Vector3(-v.z,0,v.x).normalize();rod(outside,m.stone,p.clone().addScaledVector(n,-1.1).setY(.055).toArray(),p.clone().addScaledVector(n,1.1).setY(.055).toArray(),.012);}
  // A muted grove frames the approach, with a pale stone arrival court.
  const lawn=mesh(outside,new T.PlaneGeometry(220,220),m.grass,0,-.13,0);lawn.rotation.x=-Math.PI/2;lawn.castShadow=false;
  box(outside,m.floor,0,-.075,-3.5,20,.11,8);
  for(let i=0;i<10;i++)box(outside,m.stone,-9+i*2,-.014,-3.5,.025,.012,8);
  const trees=[[-12,-5,1.3],[-13,-17,1.45],[12,-11,1.7],[13,1,1.25],[-11,9,1.15],[11,18,1.25],[-12,25,1.3],[15,-27,1.45]];
  trees.forEach(([x,z,size],i)=>autumnTree(outside,m,x,z,size,i));
  for(const side of [-1,1]){
    for(let i=0;i<12;i++)foliage(outside,[m.sage,m.moss,m.olive][i%3],side*(6.6+i*.45),.44,-4.7+(i%3)*.5,.6,i);
    for(let i=0;i<4;i++)box(outside,m.wood,side*7,.58,-1.7+i*.15,2.5,.1,.13);
    for(const xx of [-.9,.9])box(outside,m.forest,side*7+xx,.27,-1.48,.12,.54,.64);
  }
  for(const [x,z] of [[-3,27],[7,14],[6,3],[-3,-2]]){rod(outside,m.forest,[x,0,z],[x,2.45,z],.035);box(outside,m.trim,x,2.47,z,.32,.07,.32);}
  for(let i=0;i<52;i++){
    const t=(i+.3)/53,p=curve.getPoint(t),tangent=curve.getTangent(t),side=i%2?1:-1;
    p.add(new T.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(side*(1.4+(i%5)*.26)));
    const leaf=mesh(outside,new T.CircleGeometry(.06+(i%3)*.025,5),i%2?m.olive:m.heather,p.x,.035,p.z);leaf.rotation.set(-Math.PI/2,0,i*.71);leaf.scale.x=1.7;leaf.castShadow=false;
  }
  // Soft clouds and distant pale buildings give the grove a gentle horizon.
  const cloud=new T.MeshBasicMaterial({color:'#ffffff'}),distant=new T.MeshBasicMaterial({color:'#e1e5e1'});
  for(const [x,y,z] of [[-19,15,-29],[17,17,-36]]){ball(outside,cloud,x+2.2,y-.3,z,2.5,1.2,.19,.55);for(let i=0;i<5;i++)ball(outside,cloud,x+i*1.1,y+Math.sin(i)*.45,z,.95,1.1,.65,1);}
  for(let i=0;i<7;i++)box(outside,distant,(i<3?-1:1)*(21+i*2),2.5+(i%3),-37-i%2*6,3.5,5+(i%3)*2,5);
  // A real freestanding directional arrow at the start of the winding path.
  const welcome=new T.Group();welcome.position.set(-9,0,21);welcome.rotation.y=.15;outside.add(welcome);
  box(welcome,m.wood,0,1.1,0,.11,2.2,.11);
  const shape=new T.Shape();shape.moveTo(-1.5,-.42);shape.lineTo(.9,-.42);shape.lineTo(1.5,0);shape.lineTo(.9,.42);shape.lineTo(-1.5,.42);shape.closePath();
  mesh(welcome,new T.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:2,steps:1}),m.trim,0,2.1,0);
  label(welcome,'MORRISSETTE  →',-.15,2.1,.18,2.3,.4,'#45384f','#ffffff',true);
  // Six physical signboards rise on their posts beside the entrance.
  const signs=siteContent.ecosystem.nodes.map((name,i)=>{
    const sign=new T.Group();outside.add(sign);
    box(sign,m.wood,0,1.5,0,.07,3,.09);
    const face=new T.Shape();face.moveTo(-1.65,-.42);face.lineTo(1.34,-.42);face.lineTo(1.72,0);face.lineTo(1.34,.42);face.lineTo(-1.65,.42);face.closePath();
    const board=mesh(sign,new T.ExtrudeGeometry(face,{depth:.08,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:1,steps:1}),m.trim,0,3,0);
    if(i%2)board.scale.x=-1;
    const title=name==='Entrepreneurial programming'?'Entrepreneurial\nprogramming':name==='Venture development'?'Venture\ndevelopment':name==='Funding programs'?'Funding\nprograms':name;
    label(sign,title,i%2?.13:-.13,3,.141,2.72,.72,'#45384f','#ffffff',true);
    sign.traverse(object=>{if(object instanceof T.Mesh){object.material=(object.material as T.Material).clone();object.material.clippingPlanes=[new T.Plane(new T.Vector3(0,1,0),0)];object.material.clipShadows=true;}});
    sign.children.slice(1).forEach(child=>{child.rotation.z=(i%2?1:-1)*(.012+(i%3)*.008);});
    sign.userData.row=Math.floor(i/2);return sign;
  });
  // The classroom keeps its own daylight and shadows while the facade passes by.
  // Exterior roofs must not change the interior illumination during the cutaway.
  outside.traverse(object=>{if(object instanceof T.Mesh)object.castShadow=false;});
  return {outside,doors,signs};
}

export function createCampusView(canvas:HTMLCanvasElement, mode:'journey'|'room') {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const scene=new T.Scene();const skyCanvas=document.createElement('canvas');skyCanvas.width=16;skyCanvas.height=256;
  const skyContext=skyCanvas.getContext('2d')!;const skyTexture=new T.CanvasTexture(skyCanvas);skyTexture.colorSpace=T.SRGBColorSpace;scene.background=skyTexture;scene.fog=new T.Fog('#f0f2ef',48,100);
  const skyTop=new T.Color('#e2e7e5'),skyBottom=new T.Color('#fafafa'),roomTop=new T.Color('#ecefed'),roomBottom=new T.Color('#f8f7f9');let lastSky=-1;
  const camera=new T.PerspectiveCamera(40,1,.08,160);const m=materials();
  scene.add(new T.HemisphereLight('#ffffff','#c9c7c2',2.6));
  const sun=new T.DirectionalLight('#fffdf8',2.8);sun.position.set(-12,24,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-25;sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
  const ground=mesh(scene,new T.PlaneGeometry(250,250),new T.ShadowMaterial({color:'#675b54',opacity:.15}),0,-.16,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  const interior=classroom(m);scene.add(interior.room);interior.room.position.z=-11.7;
  const exterior=mode==='journey'?campus(m):null;if(exterior)scene.add(exterior.outside);
  const route=new T.CatmullRomCurve3([new T.Vector3(13,12,36),new T.Vector3(5,10,25),new T.Vector3(-1,7.5,18),new T.Vector3(1,4.5,11),new T.Vector3(0,3.1,7)]);
  const roomTarget=new T.Vector3(0,1.25,-11.7);
  const roomPosition=new T.Vector3(3.4,8.3,-6);
  const mobileRoomPosition=new T.Vector3(0,11.2,-10.2);
  const entryCurve=(portrait:boolean)=>new T.CatmullRomCurve3([
    new T.Vector3(0,portrait?7.1:3.1,portrait?16:7),
    new T.Vector3(0,2.55,-4.7),new T.Vector3(0,2.5,-7.2),
    new T.Vector3(portrait?0:1.2,5,-8.3),portrait?mobileRoomPosition:roomPosition,
  ]);
  const entryRoutes=[entryCurve(false),entryCurve(true)];
  const soften=(value:number)=>{const t=T.MathUtils.clamp(value,0,1);return t*t*t*(t*(t*6-15)+10);};
  const raycaster=new T.Raycaster();
  let width=1,height=1;
  function render(progress=0) {
    const portrait=width/height<.85;
    const roomFov=portrait?77:63;
    const p=Math.max(0,Math.min(1,progress));
    if(mode==='room') {camera.position.copy(portrait?mobileRoomPosition:roomPosition);camera.lookAt(roomTarget);camera.fov=roomFov;}
    else {
      if(p<.56){
        const t=soften(p/.56);camera.position.copy(route.getPointAt(t));
        if(portrait){camera.position.x*=.25;camera.position.y+=4;camera.position.z+=9;}
        camera.lookAt(new T.Vector3(0,4,-2).lerp(new T.Vector3(0,2.3,-7),t));camera.fov=portrait?49+soften((p-.4)/.16):40+8*soften((p-.4)/.16);
      } else if(p<.72){camera.position.set(0,portrait?7.1:3.1,portrait?16:7);camera.lookAt(0,2.3,-7);camera.fov=portrait?50:48;}
      else {
        // One continuous, distance-parameterized move through the doorway and up.
        const t=soften((p-.72)/.22);
        camera.position.copy(entryRoutes[portrait?1:0].getPointAt(t));
        camera.lookAt(new T.Vector3(0,2.3,-7).lerp(roomTarget,soften(t)));
        camera.fov=T.MathUtils.lerp(portrait?50:48,roomFov,soften((t-.5)/.5));
      }
      const opening=T.MathUtils.smoothstep(p,.705,.805);exterior!.doors[0].rotation.y=-opening*Math.PI*.56;exterior!.doors[1].rotation.y=opening*Math.PI*.56;
      exterior!.outside.visible=p<.72||camera.position.z>-7.1&&p<.86;
      exterior!.signs.forEach((sign,i)=>{
        const row=Math.floor(i/2),growth=T.MathUtils.smoothstep(p,.43+row*.025,.545+row*.025);
        sign.position.set((i%2?1:-1)*(portrait?2.25:3.8),-3.5*(1-growth),portrait?-1.5:-2);
        sign.scale.set(portrait?.72:.94,1,1);
        // Each board shares a ground anchor, then rises to its own height.
        sign.children.forEach((child,j)=>{if(j>0)child.position.y=(portrait?1.0:1.05)+row*(portrait?.88:1.05);});
        const post=sign.children[0];post.scale.y=((portrait?1.0:1.05)+row*(portrait?.88:1.05))/3;post.position.y=post.scale.y*1.5;
        sign.visible=growth>0;
      });
    }
    // Reserve a quiet lower-left copy area without moving or resizing the canvas.
    const framing=mode==='room'?1:soften((p-.84)/.10);
    camera.setViewOffset(width,height,portrait?0:-width*.085*framing,height*(portrait?.14:.035)*framing,width,height);
    const skyBlend=mode==='room'?1:soften((p-.79)/.15);
    if(skyBlend!==lastSky){
      lastSky=skyBlend;const top=skyTop.clone().lerp(roomTop,skyBlend),bottom=skyBottom.clone().lerp(roomBottom,skyBlend);
      const gradient=skyContext.createLinearGradient(0,0,0,256);gradient.addColorStop(0,`#${top.getHexString()}`);gradient.addColorStop(1,`#${bottom.getHexString()}`);skyContext.fillStyle=gradient;skyContext.fillRect(0,0,16,256);skyTexture.needsUpdate=true;scene.fog!.color.copy(bottom);
    }
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera);
    if(mode==='room'||p>=.86)canvas.dataset.seats=JSON.stringify(interior.people.map(person=>{const point=person.localToWorld(new T.Vector3(0,2.8,0)).project(camera);return {x:(point.x+1)*width/2,y:(1-point.y)*height/2};}));
    if(mode==='room'||p>=.86)canvas.dataset.pickPoints=JSON.stringify(interior.people.map(person=>{const point=person.localToWorld(new T.Vector3(0,2.18,.1)).project(camera);return {x:(point.x+1)*width/2,y:(1-point.y)*height/2};}));
    if(exterior)canvas.dataset.signs=JSON.stringify(exterior.signs.map(sign=>{
      const points=[[-1.72,-.42],[1.72,-.42],[-1.72,.42],[1.72,.42]].map(([x,y])=>sign.children[1].localToWorld(new T.Vector3(x,y,.14)).project(camera));
      return {height:sign.position.y,visible:sign.visible,left:Math.min(...points.map(v=>(v.x+1)*width/2)),right:Math.max(...points.map(v=>(v.x+1)*width/2)),top:Math.min(...points.map(v=>(1-v.y)*height/2)),bottom:Math.max(...points.map(v=>(1-v.y)*height/2))};
    }));
    canvas.dataset.camera=camera.position.toArray().map(n=>n.toFixed(2)).join(',');canvas.dataset.doors=exterior?exterior.doors[0].rotation.y.toFixed(3):'room';
  }
  return {
    resize(w:number,h:number){const nextWidth=Math.max(1,w),nextHeight=Math.max(1,h);if(width!==nextWidth||height!==nextHeight){width=nextWidth;height=nextHeight;renderer.setSize(width,height,false);}},render,
    pick(x:number,y:number){raycaster.setFromCamera(new T.Vector2(x,y),camera);const hits=raycaster.intersectObjects(interior.people,true);if(!hits.length)return -1;return interior.people.findIndex(person=>{let node:T.Object3D|null=hits[0].object;while(node){if(node===person)return true;node=node.parent;}return false;});},
    dispose(){scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Sprite){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(mat=>{for(const value of Object.values(mat))if(value instanceof T.Texture)value.dispose();mat.dispose();});}});skyTexture.dispose();renderer.dispose();renderer.forceContextLoss();},
  };
}
