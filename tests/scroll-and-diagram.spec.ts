import { test, expect } from '@playwright/test';
import { journeyScrollProgress } from '../src/lib/motion/pacing';

test('Experience advances all five positions with deliberate input while keeping the page fixed', async ({ page }) => {
  await page.goto('/#venture-studio');
  await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-locked', 'experience');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as {fieldSteps: string[]}).fieldSteps = log;
    new MutationObserver(records => {
      for (const record of records) if (record.attributeName === 'data-active-person') log.push((record.target as HTMLElement).dataset.activePerson!);
    }).observe(document.querySelector('.field')!, { attributes: true });
  });
  const position = await page.evaluate(() => scrollY);
  // A 480px hold on Venture Studio, 720px on Founder Labs, then two 240px
  // highlights complete the sequence.
  // Dispatch exact normalized input: WebKit rounds native wheel pixels, and
  // mobile WebKit does not implement Playwright's mouse wheel API.
  await page.evaluate(() => document.body.dispatchEvent(new WheelEvent('wheel', { deltaY: 479, cancelable: true, bubbles: true })));
  await expect(page.locator('#experience')).toHaveAttribute('data-active-program', '0');
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await page.evaluate(() => document.body.dispatchEvent(new WheelEvent('wheel', { deltaY: 1201, cancelable: true, bubbles: true })));
  await expect(page.locator('.field')).toHaveAttribute('data-active-person', '2');
  await expect(page.locator('#experience')).toHaveAttribute('data-active-program', '2');
  expect(await page.evaluate(() => (window as unknown as {fieldSteps: string[]}).fieldSteps)).toEqual(['1','2']);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await expect(page.locator('.wec-site')).toHaveAttribute('data-scroll-locked', 'experience');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-locked');
});

test('the path keeps all six opportunities readable in reading mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wec-motion-v2', 'off'));
  await page.goto('/#ecosystem');
  await expect(page.locator('.opportunity-name')).toHaveText(['Competitions', 'Funding programs', 'Venture development', 'Entrepreneurial programming', 'Alumni', 'Mentors']);
  await expect(page.locator('#ecosystem')).not.toContainText('larger world');
  await expect(page.locator('.arrival-directory')).toBeVisible();
  expect(await page.locator('.opportunity-sign').evaluateAll(nodes => nodes.every((el, i) => {
    const a = el.getBoundingClientRect();
    return el.scrollWidth <= el.clientWidth + 1 && a.left >= 0 && a.right <= innerWidth && nodes.slice(i+1).every(other => {
      const b = other.getBoundingClientRect();
      return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
    });
  }))).toBeTruthy();
  await expect(page.locator('.circle-person')).toHaveCount(6);
  expect(await page.locator('.circle-person').evaluateAll(nodes => nodes.every((el, i) => {
    const a = el.getBoundingClientRect();
    return el.scrollWidth <= el.clientWidth + 1 && a.left >= 0 && a.right <= innerWidth && nodes.slice(i+1).every(other => {
      const b = other.getBoundingClientRect();
      return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
    });
  }))).toBeTruthy();
});

test('the 3D approach shows all six signs at the entrance before opening the doors and reverses', async ({ page }) => {
  await page.goto('/#ecosystem');
  await expect(page.locator('.wec-site')).toHaveAttribute('data-spatial-story', 'true');
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  const start = await page.locator('.ecosystem-scene').evaluate(el => el.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')));
  const travel = await page.locator('.ecosystem-scene').evaluate(el => (el as HTMLElement).offsetHeight);
  expect(travel).toBeGreaterThan((await page.evaluate(()=>innerHeight))*2.5);
  // The approach stays short; the front-door hold is slightly faster than the interior entry.
  expect(travel * journeyScrollProgress(.6)).toBeLessThan((await page.evaluate(()=>innerHeight))*.55);
  const canvas = page.locator('.campus-render-journey canvas');
  await page.evaluate(y => scrollTo(0, y), start - 2);
  await expect(page.locator('.journey-welcome')).toHaveCSS('opacity', '1');
  await expect(page.locator('.arrival-directory')).toHaveCSS('opacity', '0');
  await expect(page.locator('.campus-render-journey')).toHaveAttribute('data-ready', 'true');
  const distant = await canvas.getAttribute('data-camera');
  await page.evaluate(y => scrollTo(0, y), start + travel * journeyScrollProgress(.4));
  await expect.poll(() => canvas.getAttribute('data-camera')).not.toBe(distant);
  await expect(page.locator('.arrival-directory')).toHaveCSS('opacity', '0');
  await page.evaluate(y => scrollTo(0, y), start + travel * journeyScrollProgress(.51));
  await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-signs'))!).some((sign:{height:number;visible:boolean})=>sign.visible&&sign.height<0)).toBeTruthy();
  await page.evaluate(y => scrollTo(0, y), start + travel * journeyScrollProgress(.65));
  await expect(page.locator('.arrival-directory')).toHaveCSS('opacity', '1');
  await expect.poll(async()=>JSON.parse((await canvas.getAttribute('data-signs'))!).every((sign:{height:number;visible:boolean})=>sign.visible&&sign.height===0)).toBeTruthy();
  const signBounds=JSON.parse((await canvas.getAttribute('data-signs'))!) as {height:number;visible:boolean;left:number;right:number;top:number;bottom:number}[];
  const viewport=await canvas.boundingBox();
  expect(signBounds).toHaveLength(6);
  for(const sign of signBounds){expect(sign.visible).toBeTruthy();expect(sign.height).toBe(0);expect(sign.left).toBeGreaterThanOrEqual(0);expect(sign.right).toBeLessThanOrEqual(viewport!.width);expect(sign.top).toBeGreaterThanOrEqual(0);expect(sign.bottom).toBeLessThanOrEqual(viewport!.height);}
  await expect(canvas).toHaveAttribute('data-doors', '0.000');
  await page.evaluate(y => scrollTo(0, y), start + travel * journeyScrollProgress(.87));
  await expect.poll(() => canvas.getAttribute('data-doors')).not.toBe('0.000');
  for(const progress of [.8,.88,.90,.95,.985,.999]) {
    await page.evaluate(y=>scrollTo(0,y),start+travel*journeyScrollProgress(progress));
    await expect.poll(()=>canvas.evaluate(el=>{const r=el.getBoundingClientRect();return Math.max(Math.abs(r.left),Math.abs(r.right-innerWidth),Math.abs(r.bottom-innerHeight));})).toBeLessThan(1);
    expect(await page.evaluate(()=>!!document.elementFromPoint(innerWidth/2,innerHeight-2)?.closest('.ecosystem-scene-stage'))).toBeTruthy();
    await expect(page.locator('.ecosystem-scene-stage')).toHaveCSS('background-color','rgb(240, 242, 239)');
    if(progress===.88)await expect.poll(()=>page.locator('.journey-classroom-caption').evaluate(el=>Number(getComputedStyle(el).opacity))).toBeGreaterThan(.2);
    const labels=page.locator('.journey-people');
    if(progress===.90)await expect(labels).toHaveCSS('opacity','0');
    if(progress===.95)await expect.poll(()=>labels.evaluate(el=>Number(getComputedStyle(el).opacity))).toBeCloseTo(.5,1);
    if(progress===.985)await expect(labels).toHaveCSS('opacity','1');
  }
  await page.evaluate(y => scrollTo(0, y), start + travel - 1);
  await expect(page.locator('.ecosystem-scene-stage')).toHaveCSS('opacity','1');
  const roomCanvas=page.locator('.campus-render-room canvas');
  await expect.poll(async()=>await canvas.getAttribute('data-camera')===await roomCanvas.getAttribute('data-camera')).toBeTruthy();
  await expect.poll(async()=>{
    const a=await canvas.evaluate(el=>el.getBoundingClientRect().toJSON()),b=await roomCanvas.evaluate(el=>el.getBoundingClientRect().toJSON());
    return Math.max(Math.abs(a!.x-b!.x),Math.abs(a!.y-b!.y),Math.abs(a!.width-b!.width),Math.abs(a!.height-b!.height));
  }).toBeLessThan(4);
  const hideCopy=await page.addStyleTag({content:'.campus-seat-labels,.classroom-caption,.audience-answer{visibility:hidden!important}'});
  const arrivalBounds=(await canvas.boundingBox())!;
  const arrivalImage=(await page.screenshot({clip:{x:arrivalBounds.x,y:arrivalBounds.y+16,width:arrivalBounds.width,height:arrivalBounds.height-32}})).toString('base64');
  const before=JSON.parse((await canvas.getAttribute('data-seats'))!) as {x:number;y:number}[];
  await page.evaluate(y => scrollTo(0, y), start + travel + 2);
  await expect(roomCanvas).toBeVisible();
  await expect(page.locator('.ecosystem-scene-stage')).toHaveCSS('opacity','0');
  const roomBounds=(await roomCanvas.boundingBox())!;
  const roomImage=(await page.screenshot({clip:{x:roomBounds.x,y:roomBounds.y+16,width:roomBounds.width,height:roomBounds.height-32}})).toString('base64');
  // Compare rendered surfaces, including their shadows, across the handoff.
  const lightingDifference=await page.evaluate(async([first,second])=>{
    const pixels=async(source:string)=>{const image=new Image();image.src=`data:image/png;base64,${source}`;await image.decode();const c=document.createElement('canvas');c.width=160;c.height=Math.round(160*image.height/image.width);const context=c.getContext('2d')!;context.drawImage(image,0,0,c.width,c.height);return context.getImageData(0,0,c.width,c.height).data;};
    const [a,b]=await Promise.all([pixels(first),pixels(second)]);let difference=0;for(let i=0;i<a.length;i++)if(i%4!==3)difference+=Math.abs(a[i]-b[i]);return difference/(a.length*.75);
  },[arrivalImage,roomImage]);
  expect(lightingDifference).toBeLessThan(2);
  await hideCopy.evaluate(el=>el.parentNode?.removeChild(el));
  const after=JSON.parse((await roomCanvas.getAttribute('data-seats'))!) as {x:number;y:number}[];
  for(let i=0;i<6;i++){expect(Math.abs(before[i].x-after[i].x)).toBeLessThan(2);expect(Math.abs(before[i].y-after[i].y)).toBeLessThan(2);}
  await expect(page.locator('.ecosystem-scene-stage')).toHaveCSS('opacity', '0');
  await expect(page.locator('#audience-heading')).toBeInViewport();
  await expect(page.locator('.wec-site')).not.toHaveAttribute('data-scroll-locked');
  await page.evaluate(y => scrollTo(0, y), start + travel * journeyScrollProgress(.95));
  await expect.poll(()=>page.locator('.journey-people').evaluate(el=>Number(getComputedStyle(el).opacity))).toBeCloseTo(.5,1);
  await page.evaluate(y => scrollTo(0, y), start + travel * journeyScrollProgress(.65));
  await expect(page.locator('.arrival-directory')).toHaveCSS('opacity', '1');
  await expect(canvas).toHaveAttribute('data-doors', '0.000');
  await page.evaluate(y => scrollTo(0, y), start - 2);
  await expect(page.locator('.journey-welcome')).toHaveCSS('opacity', '1');
  await expect.poll(() => canvas.getAttribute('data-camera')).toBe(distant);
  await page.locator('.motion-toggle').evaluate(el => (el as HTMLButtonElement).click());
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('.arrival-directory')).toBeVisible();
  await expect(page.locator('.audience')).not.toHaveAttribute('style', /transform/);
});

test('all six seated people are visible and can be selected directly in the 3D classroom', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wec-motion-v2', 'off'));
  await page.goto('/#find-your-place');
  const canvas=page.locator('.campus-render-room canvas');
  await expect(page.locator('.campus-render-room')).toHaveAttribute('data-ready','true');
  await page.evaluate(()=>{const canvas=document.querySelector('.campus-render-room canvas')!;scrollTo(0,canvas.getBoundingClientRect().top+scrollY-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')));});
  for(let i=0;i<6;i++) {
    const seats=JSON.parse((await canvas.getAttribute('data-pick-points'))!) as {x:number;y:number}[];
    const size=await canvas.boundingBox();const point=seats[i];
    expect(point.x).toBeGreaterThan(0);expect(point.x).toBeLessThan(size!.width);
    expect(point.y).toBeGreaterThan(0);expect(point.y).toBeLessThan(size!.height);
    await canvas.click({position:point});
    await expect(page.locator(`.circle-person-${i}`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator(`.circle-person-${i}`)).toBeInViewport({ratio:.99});
    await expect(page.locator('.audience .classroom-caption')).toBeInViewport({ratio:1});
    await expect(page.locator('#audience-answer')).toBeInViewport({ratio:1});
    if(page.viewportSize()!.width<760)await expect.poll(()=>page.locator('.audience .classroom-caption').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('#audience-answer')!.getBoundingClientRect().top)).toBeTruthy();
    expect(await page.locator('.audience .classroom-caption').evaluate(el=>el.getBoundingClientRect().left<innerWidth*.1)).toBeTruthy();
    expect(await page.locator('.circle-person').evaluateAll(nodes=>nodes.every(el=>{
      const a=el.getBoundingClientRect();return ['.audience .classroom-caption','#audience-answer'].every(selector=>{const b=document.querySelector(selector)!.getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;});
    }))).toBeTruthy();
  }
  await expect(page.locator('.circle-person-0')).toHaveCSS('font-size',(page.viewportSize()!.width<760?'27.5':'32.5')+'px');
  // The same six choices remain keyboard operable outside the canvas.
  await page.locator('.circle-person-0').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.circle-person-0')).toHaveAttribute('aria-pressed','true');
});

test('the classroom keeps its image and six working choices when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wec-motion-v2', 'off');
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]) {
      if(type.startsWith('webgl'))return null;
      return Reflect.apply(getContext,this,[type,...args]);
    } as typeof getContext;
  });
  await page.goto('/#find-your-place');
  await expect(page.locator('.campus-render-room')).toHaveAttribute('data-fallback','true');
  await expect(page.locator('.campus-render-room .campus-fallback')).toBeVisible();
  expect(await page.locator('.campus-render-room .campus-fallback').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.circle-person')).toHaveCount(6);
  await page.locator('.circle-person-1').click();
  await expect(page.locator('#audience-answer')).toContainText('Founder Labs');
});
