import { chromium } from 'playwright';
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
 await page.waitForSelector('[data-story-desktop]');
 for(const [name,selector,count] of [['experience','.experience-nav button',3],['field','.field-person button',3]]){
  for(let i=0;i<count;i++){
   await page.locator(selector).nth(i).click();
   await page.waitForTimeout(900);
   await page.screenshot({path:`artifacts/motion-${name}-${i}.png`});
  }
  await page.keyboard.press('Escape');
 }
 await page.locator('.foundation-nav button').last().click();
 await page.waitForTimeout(900);
 await page.locator('#pillars').screenshot({path:'artifacts/motion-foundations.png'});
 console.log(await page.evaluate(()=>({pinnedStages:document.querySelectorAll('.pin-spacer').length,viewport:innerHeight})));
 await browser.close();
})();
