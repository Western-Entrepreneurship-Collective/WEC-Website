import { chromium } from 'playwright';
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.addInitScript(() => localStorage.setItem('wec-motion-v2','off'));
 await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
 for(const id of ['about','experience','from-the-field','community','pillars','ecosystem','find-your-place','join']){
  await page.locator('#'+id).screenshot({path:'artifacts/section-'+id+'.png'});
 }
 await browser.close();
})();
