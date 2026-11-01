import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// Real edit form, import preview, cards, table, controls and stats. Only
// routing/auth, remote lookups and unrelated widgets are boundary substitutes.
const stubs: Record<string, string> = {
  'next/navigation': `export const useRouter=()=>({refresh(){},push(){}});`,
  'next/link': `import React from 'react'; export default ({children,...props})=><a {...props}>{children}</a>;`,
  'next/image': `import React from 'react'; export default props=><img {...props}/>;`,
  '@/contexts/ThemeContext': `export const useTheme=()=>({theme:'light'});`,
  '@/utils/materials': `export const getMaterials=async()=>[{id:'pc',name:'PC'}];`,
  '@/utils/stemShapes': `export const getStemShapes=async()=>[{id:'mx',name:'MX'}];`,
  '@/utils/manufacturerValidation': `export const validateManufacturers=async()=>new Map();`,
  'ForceCurvesButton': `export default ()=>null;`, 'SwitchScoresButton': `export default ()=>null;`,
  'SwitchImageManager': `export default ()=>null;`, 'ImageCarousel': `export default ()=>null;`,
  'SwitchShareButton': `export default ()=>null;`, 'PrintLabelButton': `export default ()=>null;`,
  'recharts': `export const PieChart=()=>null, Pie=()=>null, Cell=()=>null, ResponsiveContainer=()=>null, Legend=()=>null, Tooltip=()=>null, LineChart=()=>null, Line=()=>null, XAxis=()=>null, YAxis=()=>null, CartesianGrid=()=>null;`,
}
const source = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import Edit from './src/components/EditSwitchModal';
import Bulk from './src/app/dashboard/bulk-upload/page';
import Card from './src/components/SwitchCard'; import Table from './src/components/SwitchTable';
import Stats from './src/components/CollectionStats'; import Controls from './src/components/CollectionControls';
import {deriveSwitchFilterOptions} from './src/lib/switch-filters';
const root=createRoot(document.getElementById('root')); let key=0;
const row={id:'owned',name:'Same',manufacturer:'A',notes:'Ordinary notes',personalNotes:'Unlinked personal notes',quantity:0,type:'TACTILE',actuationForce:0,tactileForce:0,tactilePosition:0,preTravel:0,bottomOut:0,masterSwitchId:null,images:[],personalTags:[]};
window.showEdit=(linked=false)=>root.render(<Edit key={++key} switch={{...row,masterSwitchId:linked?'master':null}} onClose={()=>{}} onSwitchUpdated={()=>{}}/>);
window.showBulk=()=>root.render(<Bulk key={++key}/>);
window.showRead=()=>root.render(<><Card switch={row} onEdit={()=>{}} onDelete={()=>{}} showForceCurves={false}/><Table switches={[row]} onEdit={()=>{}} onDelete={()=>{}} showForceCurves={false}/><Stats switches={[row,{...row,id:'2',quantity:12},{...row,id:'3',quantity:null}]}/><Controls onSearchChange={()=>{}} onSortChange={value=>window.lastSort=value} onViewModeChange={()=>{}} onFilterChange={()=>{}} filterOptions={deriveSwitchFilterOptions([row])}/></>);
window.showEdit();
`

test('real UI keeps unlinked notes accessible, validates form clears, and blocks ambiguous or edited overwrite targets', async t => {
  const built = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'boundaries', setup(b) {
      b.onResolve({ filter: /.*/ }, args => { const leaf=args.path.split('/').pop()!; const key=Object.hasOwn(stubs,args.path)?args.path:Object.hasOwn(stubs,leaf)?leaf:null; if(key) return {path:key,namespace:'stub'} })
      b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({contents:stubs[args.path],loader:'tsx',resolveDir:process.cwd()}))
    } }] })
  const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html');res.end(req.url==='/bundle.js'?built.outputFiles[0].text:'<div id="root"></div><script src="/bundle.js"></script>')})
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())))
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_CHROMIUM_PATH})
  t.after(()=>browser.close())
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  page.setDefaultTimeout(7000)
  const errors:string[]=[], writes:{url:string;body:any;method:string}[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('dialog',dialog=>dialog.dismiss())
  await page.route('**/api/**',async route=>{
    const request=route.request(), path=new URL(request.url()).pathname
    if(request.method()!=='GET') {
      writes.push({url:path,body:request.postDataJSON(),method:request.method()})
      if(path==='/api/master-switches/submit') return route.fulfill({status:409,json:{error:'Fixture submission rejected'}})
      return route.fulfill({json:{id:'owned',...request.postDataJSON()}})
    }
    if(path==='/api/switches') return route.fulfill({json:[{id:'owned',name:'Same',manufacturer:'A'}]})
    if(path.endsWith('/sync-master')) return route.fulfill({json:{isLinkedToMaster:false,hasUpdates:false}})
    if(path==='/api/user/tags') return route.fulfill({json:{tags:[]}})
    return route.fulfill({json:[]})
  })
  await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}`)
  const personal=page.locator('textarea[name="personalNotes"]')
  await personal.waitFor(); assert.equal(await personal.inputValue(),'Unlinked personal notes')
  const long='Long legacy personal notes 🎹 '.repeat(400)
  await personal.fill(long)
  await page.locator('input[name="quantity"]').fill('0')
  await page.locator('input[name="actuationForce"]').fill('')
  await page.getByRole('button',{name:'Update Switch',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('button')!==null)
  await page.waitForTimeout(100)
  const save=writes.find(write=>write.method==='PUT')!
  assert.ok(save); assert.equal(save.body.personalNotes,long); assert.equal(save.body.quantity,0); assert.equal(save.body.actuationForce,null)
  await page.evaluate(()=>(window as any).showEdit())
  await personal.waitFor()
  await page.getByRole('button',{name:'Submit to Master DB',exact:true}).click()
  await page.locator('#submissionNotes').fill('A sufficiently detailed submission reason')
  await page.getByRole('button',{name:'Submit',exact:true}).click()
  await page.getByText('Fixture submission rejected').first().waitFor()
  await page.getByRole('button',{name:'Cancel',exact:true}).last().click()
  assert.equal(await personal.isVisible(),true)
  assert.equal(await personal.inputValue(),'Unlinked personal notes\n\nOrdinary notes')
  assert.equal(await page.locator('textarea[name="notes"]').inputValue(),'')
  assert.ok(writes.some(write=>write.url.endsWith('/update-notes') && write.body.personalNotes==='Unlinked personal notes\n\nOrdinary notes'))
  await page.evaluate(()=>(window as any).showEdit(true))
  assert.equal(await personal.inputValue(),'Unlinked personal notes')
  await page.evaluate(()=>(window as any).showRead())
  await page.getByText('Unlinked personal notes',{exact:true}).first().waitFor()
  assert.equal(await page.getByText('Unlinked personal notes',{exact:true}).count(),2)
  assert.ok((await page.locator('body').innerText()).includes('12 known units'))
  assert.ok((await page.locator('body').innerText()).includes('1 entries with unknown quantity'))
  assert.ok((await page.locator('body').innerText()).includes('Quantity: 0'))
  assert.ok((await page.locator('body').innerText()).includes('Actuation: 0g'))
  assert.ok((await page.locator('body').innerText()).includes('Qty: 0'))
  const sort=page.locator('select').filter({has:page.locator('option[value="quantity-asc"]')})
  await sort.selectOption('quantity-desc')
  assert.equal(await page.evaluate(()=>(window as any).lastSort),'quantity-desc')
  async function preview(csv:string) {
    await page.evaluate(()=>(window as any).showBulk())
    await page.locator('input[type="file"]').setInputFiles({name:'scope.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
    await page.getByRole('button',{name:'Continue to Preview'}).click()
  }
  await preview('Collection Switch ID,Switch Name,Manufacturer,Quantity\nowned,Same,A,0\nowned,Same,A,2\n')
  await page.getByText(/Repeated collection ID/).first().waitFor()
  assert.equal(await page.getByText('Overwrite owned entry',{exact:true}).count(),0)
  assert.equal(await page.getByText('Create separate entry',{exact:true}).count(),2)
  await preview('Collection Switch ID,Switch Name,Manufacturer,Quantity\nowned,Same,A,0\n')
  await page.getByText('Overwrite owned entry',{exact:true}).waitFor()
  await page.locator('tbody input[type="checkbox"]').first().check()
  await page.locator('tbody input[type="text"]').first().fill('Edited name')
  await page.getByText(/Identity changed/).waitFor()
  assert.equal(await page.getByText('Overwrite owned entry',{exact:true}).count(),0)
  await page.locator('tbody input[type="checkbox"]').first().check()
  await page.getByRole('button',{name:/Import 1 of 1 Switches/}).click()
  await page.getByRole('heading',{name:'Import Complete!'}).waitFor()
  assert.equal(writes.at(-1)?.method,'POST'); assert.equal(writes.at(-1)?.body.name,'Edited name')
  assert.deepEqual(errors,[])
})
