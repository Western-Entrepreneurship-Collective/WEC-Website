import { chromium } from 'playwright';
(async () => {
 const browser = await chromium.launch();
 const page = await browser.newPage({ viewport: {width:1440,height:1000}, deviceScaleFactor:1 });
 page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
 await page.goto('http://localhost:3000', {waitUntil:'networkidle'});
 await page.waitForTimeout(2200);
 await page.screenshot({path:'artifacts/desktop-hero.png'});
 console.log(await page.evaluate(() => ({title:document.title, height:document.body.scrollHeight, width:document.documentElement.scrollWidth, motion:document.querySelector('[data-story-desktop]')!==null, sections:[...document.querySelectorAll('main > section')].map(e=>({id:e.id,top:Math.round(e.getBoundingClientRect().top+scrollY),height:Math.round(e.getBoundingClientRect().height)}))})));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(() => { localStorage.setItem('wec-motion-v2','off'); window.dispatchEvent(new Event('wec-motion-preference')); });
 await page.waitForTimeout(500);
 await page.screenshot({path:'artifacts/desktop-full-reduced.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://localhost:3000', {waitUntil:'networkidle'});
 await page.screenshot({path:'artifacts/mobile-hero.png'});
 await page.screenshot({path:'artifacts/mobile-full.png',fullPage:true});
 console.log('mobile',await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.body.scrollHeight})));
 const reference = await browser.newPage({viewport:{width:1440,height:1000}});
 try { await reference.goto('https://filmbot.com',{waitUntil:'domcontentloaded',timeout:30000}); await reference.waitForTimeout(3000); await reference.screenshot({path:'artifacts/filmbot-reference.png'}); } catch(e) { console.log('Reference screenshot:',e.message); }
 await browser.close();
})();
