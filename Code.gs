// =====================================================
//  INeedPOSN — Google Apps Script Backend
//  วิธีใช้: วาง code นี้ใน script.google.com
//  แล้ว Deploy → New deployment → Web app
// =====================================================

// ── ✏️ แก้ค่าตรงนี้อย่างเดียว ───────────────────────
const SS_ID = '13JuwktfPD2igGacbQYJX7iA6LiLEgjsf6AaDWgEjQgE';
//  วิธีหา ID: เปิด Google Sheet แล้วดู URL
//  docs.google.com/spreadsheets/d/ [ID อยู่ตรงนี้] /edit
// ──────────────────────────────────────────────────────

const ชีทออเดอร์   = 'รายการสั่งซื้อ';
const ชีทบัญชี    = 'บัญชีผู้เรียน';
const โฟลเดอร์สลิป = 'INeedPOSN_สลิปชำระเงิน';

/* ── POST handler ── */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'create_order')  return ตอบกลับ(บันทึกออเดอร์(body.order));
    if (body.action === 'update_status') return ตอบกลับ(อัปเดตสถานะออเดอร์(body.orderId, body.status));
    if (body.action === 'create_user')   return ตอบกลับ(บันทึกบัญชีผู้เรียน(body.user));
    return ตอบกลับ({ ok: false, error: 'ไม่รู้จัก action' });
  } catch (err) {
    return ตอบกลับ({ ok: false, error: err.message });
  }
}

/* ── GET handler ── */
function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'get_orders') return ตอบกลับ(ดึงออเดอร์ทั้งหมด());
    if (action === 'get_users')  return ตอบกลับ(ดึงบัญชีทั้งหมด());
    return ตอบกลับ({ ok: false, error: 'ไม่รู้จัก action' });
  } catch (err) {
    return ตอบกลับ({ ok: false, error: err.message });
  }
}

/* ── สร้าง/เปิดชีทออเดอร์ ── */
function เปิดชีทออเดอร์() {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(ชีทออเดอร์);
  if (!sheet) {
    sheet = ss.insertSheet(ชีทออเดอร์);
    const หัว = [
      'หมายเลขออเดอร์','วันที่สมัคร','ชื่อ-นามสกุล','ชื่อเล่น',
      'ชั้นเรียน','โรงเรียน','ศูนย์ สอวน.','อีเมล',
      'IG','Discord','LINE ID','คอร์สที่สมัคร',
      'รหัสคอร์ส','ราคา (บาท)','ยอดที่โอน (บาท)','Username ผู้เรียน',
      'URL สลิป','สถานะ'
    ];
    sheet.getRange(1,1,1,หัว.length).setValues([หัว]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,หัว.length)
      .setBackground('#1a1a2e').setFontColor('#ffd60a')
      .setFontWeight('bold').setHorizontalAlignment('center');
    const กว้าง = [140,160,180,80,80,200,220,200,120,130,100,160,80,100,100,160,220,100];
    กว้าง.forEach((w,i) => sheet.setColumnWidth(i+1, w));
  }
  return sheet;
}

/* ── สร้าง/เปิดชีทบัญชีผู้เรียน ── */
function เปิดชีทบัญชี() {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(ชีทบัญชี);
  if (!sheet) {
    sheet = ss.insertSheet(ชีทบัญชี);
    const หัว = [
      'รหัสผู้เรียน','Username','ชื่อ-นามสกุล','ชื่อเล่น',
      'อีเมล','รหัสคอร์ส','สถานะบัญชี','หมายเลขออเดอร์',
      'วันที่สมัคร','วันที่อนุมัติ'
    ];
    sheet.getRange(1,1,1,หัว.length).setValues([หัว]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,หัว.length)
      .setBackground('#0a2a14').setFontColor('#30d158')
      .setFontWeight('bold').setHorizontalAlignment('center');
    [120,160,180,80,200,80,120,140,160,160].forEach((w,i) => sheet.setColumnWidth(i+1,w));
  }
  return sheet;
}

/* ── เปิด/สร้างโฟลเดอร์สลิปใน Drive ── */
function เปิดโฟลเดอร์สลิป() {
  const iter = DriveApp.getFoldersByName(โฟลเดอร์สลิป);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(โฟลเดอร์สลิป);
}

/* ── อัปโหลดสลิปไป Google Drive ── */
function อัปโหลดสลิป(base64, orderId) {
  if (!base64 || !base64.startsWith('data:image')) return '';
  try {
    const ส่วน = base64.split(',');
    const mime = ส่วน[0].replace('data:','').replace(';base64','');
    const blob = Utilities.newBlob(Utilities.base64Decode(ส่วน[1]), mime, orderId+'_สลิป');
    const file = เปิดโฟลเดอร์สลิป().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?export=view&id='+file.getId();
  } catch(err) {
    Logger.log('อัปโหลดสลิปผิดพลาด: '+err.message);
    return '';
  }
}

/* ── บันทึกออเดอร์ใหม่ ── */
function บันทึกออเดอร์(o) {
  const sheet = เปิดชีทออเดอร์();
  const urlสลิป = อัปโหลดสลิป(o.slip, o.id);
  sheet.appendRow([
    o.id, new Date(o.timestamp),
    o.name||'', o.nick||'', o.grade||'', o.school||'', o.center||'',
    o.email||'', o.ig||'', o.discord||'', o.line||'',
    o.course||'', o.courseKey||'',
    o.price||0, o.amtTransferred||'',
    o.username||'', urlสลิป, 'รอตรวจสอบ'
  ]);
  const r = sheet.getLastRow();
  sheet.getRange(r,2).setNumberFormat('dd/mm/yyyy HH:mm');
  sheet.getRange(r,18).setBackground('#2a1f00').setFontColor('#ff9f0a').setFontWeight('bold').setHorizontalAlignment('center');
  return { ok:true, orderId:o.id, urlสลิป };
}

/* ── บันทึกบัญชีผู้เรียนใหม่ ── */
function บันทึกบัญชีผู้เรียน(u) {
  const sheet = เปิดชีทบัญชี();
  sheet.appendRow([
    u.id||'', u.username||'', u.name||'', u.nick||'',
    u.email||'', u.courseKey||'', 'รอการอนุมัติ',
    u.orderId||'', new Date(u.createdAt||new Date()), ''
  ]);
  const r = sheet.getLastRow();
  sheet.getRange(r,9).setNumberFormat('dd/mm/yyyy HH:mm');
  sheet.getRange(r,7).setBackground('#2a1f00').setFontColor('#ff9f0a').setFontWeight('bold').setHorizontalAlignment('center');
  return { ok:true, userId:u.id };
}

/* ── อัปเดตสถานะออเดอร์ ── */
function อัปเดตสถานะออเดอร์(orderId, status) {
  const sheet = เปิดชีทออเดอร์();
  const data  = sheet.getDataRange().getValues();
  const แปลง  = { pending:'รอตรวจสอบ', paid:'ยืนยันแล้ว', rejected:'ปฏิเสธ',
                  'รอตรวจสอบ':'รอตรวจสอบ', 'ยืนยันแล้ว':'ยืนยันแล้ว', 'ปฏิเสธ':'ปฏิเสธ' };
  const สถานะไทย = แปลง[status] || status;
  const สี = { 'รอตรวจสอบ':['#2a1f00','#ff9f0a'], 'ยืนยันแล้ว':['#0a2a14','#30d158'], 'ปฏิเสธ':['#2a0a08','#ff453a'] };
  const [bg,fg] = สี[สถานะไทย] || ['#111','#aaa'];
  for (let i=1; i<data.length; i++) {
    if (String(data[i][0])===String(orderId)) {
      sheet.getRange(i+1,18).setValue(สถานะไทย).setBackground(bg).setFontColor(fg).setFontWeight('bold').setHorizontalAlignment('center');
      return { ok:true };
    }
  }
  return { ok:false, error:'ไม่พบออเดอร์: '+orderId };
}

/* ── ดึงออเดอร์ทั้งหมด ── */
function ดึงออเดอร์ทั้งหมด() {
  const sheet = เปิดชีทออเดอร์();
  const data  = sheet.getDataRange().getValues();
  if (data.length<=1) return { ok:true, orders:[] };
  const orders = data.slice(1).map(r => ({
    id:String(r[0]), timestamp:r[1] instanceof Date?r[1].toISOString():String(r[1]),
    name:String(r[2]), nick:String(r[3]), grade:String(r[4]),
    school:String(r[5]), center:String(r[6]), email:String(r[7]),
    ig:String(r[8]), discord:String(r[9]), line:String(r[10]),
    course:String(r[11]), courseKey:String(r[12]),
    price:Number(r[13]), amtTransferred:String(r[14]),
    username:String(r[15]), slipUrl:String(r[16]), status:String(r[17])
  })).reverse();
  return { ok:true, orders };
}

/* ── ดึงบัญชีผู้เรียนทั้งหมด ── */
function ดึงบัญชีทั้งหมด() {
  const sheet = เปิดชีทบัญชี();
  const data  = sheet.getDataRange().getValues();
  if (data.length<=1) return { ok:true, users:[] };
  const users = data.slice(1).map(r => ({
    id:String(r[0]), username:String(r[1]), name:String(r[2]), nick:String(r[3]),
    email:String(r[4]), courseKey:String(r[5]), status:String(r[6]),
    orderId:String(r[7]),
    createdAt:r[8] instanceof Date?r[8].toISOString():String(r[8]),
    approvedAt:r[9] instanceof Date?r[9].toISOString():String(r[9])
  })).reverse();
  return { ok:true, users };
}

/* ── Helper: ตอบกลับ JSON ── */
function ตอบกลับ(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── ทดสอบระบบ (รันใน Apps Script Editor) ── */
function ทดสอบระบบ() {
  try {
    Logger.log('✅ ชีทออเดอร์: ' + เปิดชีทออเดอร์().getName());
    Logger.log('✅ ชีทบัญชี:  ' + เปิดชีทบัญชี().getName());
    Logger.log('🎉 ระบบพร้อมใช้งาน!');
  } catch(e) {
    Logger.log('❌ ผิดพลาด: ' + e.message);
    Logger.log('👉 ตรวจสอบว่าใส่ SS_ID ถูกต้องหรือยัง');
  }
}
