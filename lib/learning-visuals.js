// Numbered empty positions follow the order and arrangement of the reading UI.
const SPREAD_POSITIONS={
 single:[[120,95]],three:[[64,95],[120,95],[176,95]],
 twochoices:[[120,30],[75,95],[75,160],[165,95],[165,160]],
 lovecross:[[64,95],[176,95],[120,95],[120,30],[120,160]],
 pentagram:[[120,30],[176,95],[176,160],[64,160],[64,95]],
 horseshoe:[[30,125],[60,95],[90,65],[120,45],[150,65],[180,95],[210,125]],
 celtic:[[80,75],[125,75],[80,130],[35,75],[80,22],[170,75],[215,170],[215,120],[215,70],[215,20]],
 lifetree:[[120,20],[65,57],[175,57],[65,95],[175,95],[120,95],[65,133],[175,133],[120,133],[120,171]],
 decision6:[[120,23],[65,73],[65,123],[175,73],[175,123],[120,173]],
 year12:Array.from({length:12},(_,i)=>[60+(i%4)*40,40+Math.floor(i/4)*57]),
 shadow5:[[120,30],[65,95],[175,95],[65,160],[175,160]]
};
export function spreadDiagram(key='three'){
 const positions=SPREAD_POSITIONS[key]||SPREAD_POSITIONS.three;
 const sizes={single:[48,80],three:[40,66],twochoices:[36,56],lovecross:[36,56],pentagram:[36,56],horseshoe:[24,40],celtic:[24,36],lifetree:[24,34],decision6:[28,40],year12:[29,46],shadow5:[36,56]};
 const [width,height]=sizes[key]||sizes.three;
 return `<svg class="spread-diagram" viewBox="0 0 240 195" aria-hidden="true" focusable="false">${positions.map(([x,y],i)=>`<g class="spread-position" data-position="${i+1}"><rect class="position-card" x="${x-width/2}" y="${y-height/2}" width="${width}" height="${height}" rx="1.5"/><rect class="position-inner" x="${x-width/2+3}" y="${y-height/2+3}" width="${width-6}" height="${height-6}" rx=".5"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${i+1}</text></g>`).join('')}</svg>`;
}
