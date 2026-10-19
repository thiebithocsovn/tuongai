const {app,BrowserWindow,shell,session}=require('electron');
const SITE='https://thiebithocsovn.github.io/tuongai/';
function trusted(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.host==='thiebithocsovn.github.io'&&u.pathname.startsWith('/tuongai/');}catch{return false;}}
function external(raw){try{const u=new URL(raw);if(['https:','mailto:'].includes(u.protocol))shell.openExternal(u.href);}catch{}}
function createWindow(){
 const win=new BrowserWindow({title:'Tường học tập AI – Truy gốc lỗi',width:1260,height:860,minWidth:360,minHeight:520,show:false,backgroundColor:'#eff5fb',autoHideMenuBar:true,
 webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
 win.once('ready-to-show',()=>win.show());
 win.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(ev,url)=>{if(!trusted(url)){ev.preventDefault();external(url);}});
 win.loadURL(SITE);
}
app.whenReady().then(()=>{
 session.defaultSession.setPermissionRequestHandler((contents,permission,reply,details)=>{
  const origin=(details&&details.requestingUrl)||contents.getURL();
  reply(trusted(origin)&&['media','clipboard-sanitized-write'].includes(permission));
 });
 createWindow();
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
