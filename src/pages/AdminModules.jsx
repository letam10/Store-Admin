import { useMemo, useState } from 'react'
import { normalizeSearch } from '../storefront/state'
import { demoVouchers, membershipPlans } from '../storefront/promotions'
import './AdminModules.css'

const datasets={
  customers:{title:'Quản lý khách hàng',description:'Theo dõi tài khoản, phân nhóm và trạng thái chăm sóc.',columns:['Khách hàng','Nhóm','Đơn gần nhất','Trạng thái'],rows:[['Nguyễn An','Thân thiết','ST-1048','Đang hoạt động'],['Trần Minh','Mới','ST-1046','Cần chăm sóc'],['Lê Hương','VIP','ST-1032','Ưu tiên']]},
  products:{title:'Quản lý hàng hóa',description:'Danh mục sản phẩm, giá niêm yết và trạng thái bán.',columns:['Sản phẩm','Danh mục','Giá','Trạng thái'],rows:[['Tai nghe Everyday','Công nghệ','890.000 ₫','Đang bán'],['Túi Everyday Tote','Phụ kiện','249.000 ₫','Đang bán'],['Đồng hồ Minimal','Phụ kiện','1.290.000 ₫','Đang bán']]},
  logistics:{title:'Quản lý lưu thông',description:'Theo dõi luân chuyển hàng giữa kho, cửa hàng và giao vận.',columns:['Mã','Tuyến','Tiến độ','Cập nhật'],rows:[['MV-221','Kho A → Store Central','72%','10 phút trước'],['MV-220','Store East → Kho A','Đã nhận','35 phút trước'],['MV-219','Kho A → Đơn online','Đang giao','1 giờ trước']]},
  inventory:{title:'Xuất nhập kho',description:'Giao diện kiểm soát phiếu nhập, phiếu xuất và tồn dự kiến.',columns:['Phiếu','Loại','Kho','Số lượng'],rows:[['IN-082','Nhập','Kho A','+128'],['OUT-117','Xuất','Kho A','-32'],['OUT-116','Xuất','Kho B','-18']]},
  appearance:{title:'Trang trí & chỉnh sửa',description:'Quản lý banner, nội dung trang chủ và bộ nhận diện hiển thị.',columns:['Khu vực','Phiên bản','Người sửa','Trạng thái'],rows:[['Hero trang chủ','v3','Admin','Nháp'],['Banner mùa mới','v2','Marketing','Đang dùng'],['Footer','v1','Admin','Đang dùng']]},
  statistics:{title:'Thống kê',description:'Tổng hợp chỉ số thương mại; số liệu production cần lấy từ backend.',columns:['Chỉ số','Hôm nay','7 ngày','Xu hướng'],rows:[['Đơn hàng','42','268','+8%'],['Khách quay lại','31%','29%','+2%'],['Tỷ lệ hoàn tất giỏ','64%','61%','+3%']]},
  'order-types':{title:'Quản lý loại đơn hàng',description:'Cấu hình nhóm đơn và cách xử lý vận hành.',columns:['Loại đơn','Ưu tiên','SLA','Trạng thái'],rows:[['Giao tiêu chuẩn','Bình thường','48h','Bật'],['Nhận tại cửa hàng','Cao','4h','Bật'],['Đơn quà tặng','Bình thường','72h','Nháp']]},
  support:{title:'Quản lý chăm sóc khách hàng',description:'Hàng đợi yêu cầu hỗ trợ và tình trạng xử lý.',columns:['Ticket','Khách','Chủ đề','Trạng thái'],rows:[['CS-301','Nguyễn An','Đơn hàng','Đang xử lý'],['CS-300','Lê Hương','Sản phẩm','Mới'],['CS-298','Trần Minh','Địa chỉ','Đã xong']]},
  'rewards-wheel':{title:'Chế độ quay thưởng',description:'Thiết kế chương trình mini-game và giới hạn phần thưởng.',columns:['Chiến dịch','Phần thưởng','Ngân sách','Trạng thái'],rows:[['Cuối tuần vui vẻ','Voucher 10%','2.000.000 ₫','Nháp'],['Khách thân thiết','Quà ngẫu nhiên','5.000.000 ₫','Tạm dừng']]},
  staff:{title:'Quản lý nhân viên',description:'Danh sách nhân viên, vai trò và ca làm việc.',columns:['Nhân viên','Vai trò','Ca hôm nay','Trạng thái'],rows:[['Mai Anh','CSKH','08:00–17:00','Đang làm'],['Quốc Bảo','Kho','13:00–22:00','Sắp vào ca'],['Thùy Linh','Cửa hàng','09:00–18:00','Đang làm']]},
  overtime:{title:'Tăng ca & khen thưởng',description:'Theo dõi đề xuất OT và ghi nhận thành tích nhân viên.',columns:['Nhân viên','Hạng mục','Thời lượng/Điểm','Trạng thái'],rows:[['Quốc Bảo','Tăng ca','2 giờ','Chờ duyệt'],['Mai Anh','Khen thưởng','120 điểm','Đã duyệt'],['Thùy Linh','Tăng ca','1.5 giờ','Đã duyệt']]},
}

function Dashboard(){
 const stats=[['Doanh thu demo','128,4 triệu','+12.8%'],['Đơn hôm nay','42','+8.1%'],['Khách quay lại','31%','+2.0%'],['Ticket mở','7','-3']]
 return <><div className="admin-kpi-grid">{stats.map(([label,value,delta])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{delta} so với kỳ trước</small></article>)}</div><div className="admin-dashboard-grid"><section className="admin-module-card"><p className="admin-eyebrow">Vận hành hôm nay</p><h2>Ưu tiên cần chú ý</h2><div className="admin-task-list"><div><b>07</b><span>Ticket CSKH đang mở</span></div><div><b>03</b><span>Phiếu kho chờ duyệt</span></div><div><b>02</b><span>Nhân viên đề nghị tăng ca</span></div></div></section><section className="admin-module-card"><p className="admin-eyebrow">Lối tắt</p><h2>Thao tác thường dùng</h2><div className="admin-quick-actions"><button type="button" disabled title="Chưa nối backend">+ Tạo hàng hóa</button><button type="button" disabled title="Chưa nối backend">+ Phiếu nhập kho</button><button type="button" disabled title="Chưa nối backend">+ Ticket CSKH</button><button type="button" disabled title="Chưa nối backend">+ Chiến dịch thưởng</button></div></section></div></>
}


function RewardsWheelPreview(){
 const [spin,setSpin]=useState(0)
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">CAMPAIGN PREVIEW</p><h2>Quay thưởng, voucher & thành viên</h2><p>Xem thử vòng quay và cấu trúc ưu đãi. Không phát thưởng, không thu phí thành viên và không ghi dữ liệu nghiệp vụ thật.</p></div><span className="admin-preview-badge">Preview cục bộ</span></div>
   <div className="reward-layout">
     <div className="reward-wheel-wrap"><div className="reward-pointer">▼</div><div className="reward-wheel" style={{transform:'rotate('+spin+'deg)'}}><span>50K</span><span>10%</span><span>Quà</span><span>VIP</span><span>Lại</span><span>15%</span></div></div>
     <div className="reward-config"><label>Tên chiến dịch<input defaultValue="Store Lucky Demo" /></label><label>Số lượt/người<input type="number" min="1" max="20" defaultValue="1" /></label><button type="button" onClick={()=>setSpin((value)=>value+497)}>Quay preview</button><small>Phần thưởng, ngân sách, xác suất và điều kiện phải được backend/pháp lý xác nhận trước khi triển khai thật.</small></div>
   </div>
   <div className="promo-admin-grid">
     <section><div className="promo-admin-head"><b>Voucher demo</b><span>{demoVouchers.length} mã</span></div>{demoVouchers.map((voucher)=><article key={voucher.code}><code>{voucher.code}</code><div><b>{voucher.label}</b><small>{voucher.description}</small></div><span>{voucher.tiers.join(' / ')}</span></article>)}</section>
     <section><div className="promo-admin-head"><b>Tier thành viên demo</b><span>{membershipPlans.length} hạng</span></div>{membershipPlans.map((plan)=><article key={plan.id}><strong>{plan.badge}</strong><div><b>{plan.name}</b><small>{plan.description}</small></div><span>{plan.price===0?'Miễn phí':new Intl.NumberFormat('vi-VN').format(plan.price)+' ₫/tháng'}</span></article>)}</section>
   </div>
 </section>
}

function AppearancePreview(){
 const [headline,setHeadline]=useState('Mua sắm gọn hơn. Sống nhẹ hơn.')
 const [tone,setTone]=useState('sage')
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">STOREFRONT EDITOR</p><h2>Trang trí & chỉnh sửa</h2><p>Thử nội dung hero và tone giao diện ngay trong phiên admin.</p></div><span className="admin-preview-badge">Chưa xuất bản</span></div>
   <div className="appearance-layout"><div className={'appearance-preview appearance-preview--'+tone}><small>STORE EVERYDAY</small><h3>{headline || 'Tiêu đề trang chủ'}</h3><button type="button" disabled>Xem hàng hóa</button></div><div className="appearance-controls"><label>Tiêu đề<input value={headline} onChange={(event)=>setHeadline(event.target.value)} maxLength="80" /></label><label>Tone<select value={tone} onChange={(event)=>setTone(event.target.value)}><option value="sage">Sage</option><option value="sand">Sand</option><option value="ink">Ink</option></select></label><button type="button" disabled title="Chưa nối CMS">Lưu bản nháp (chưa nối)</button></div></div>
 </section>
}


function StaffAccessPreview(){
 const roles=[
   ['Quản trị viên',['Dashboard','Hàng hóa','Kho','Thống kê','AI local']],
   ['Nhân viên kho',['Hàng hóa','Lưu thông','Xuất nhập kho']],
   ['CSKH',['Khách hàng','Đơn hàng','CSKH']],
 ]
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">STAFF & ACCESS</p><h2>Quản lý nhân viên</h2><p>Preview vai trò và phạm vi truy cập. Backend hiện chưa thực thi RBAC cho các module giao diện này.</p></div><span className="admin-preview-badge">Quyền demo</span></div>
   <div className="role-grid">{roles.map(([name,permissions])=><article key={name}><div><b>{name}</b><small>{permissions.length} quyền mẫu</small></div><div className="role-tags">{permissions.map((item)=><span key={item}>{item}</span>)}</div><button type="button" disabled>Chỉnh quyền</button></article>)}</div>
   <div className="admin-table-wrap staff-table"><table><caption className="sr-only">Danh sách nhân viên demo</caption><thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Ca hôm nay</th><th>Trạng thái</th></tr></thead><tbody>{datasets.staff.rows.map((row)=><tr key={row[0]}>{row.map((cell,index)=><td className={index===row.length-1?'admin-status-cell':''} key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
 </section>
}


function CustomersPreview(){
 const [query,setQuery]=useState('')
 const [segment,setSegment]=useState('Tất cả')
 const customers=[
  {name:'Nguyễn An',group:'Thân thiết',order:'ST-1048',status:'Đang hoạt động'},
  {name:'Trần Minh',group:'Mới',order:'ST-1046',status:'Cần chăm sóc'},
  {name:'Lê Hương',group:'VIP',order:'ST-1032',status:'Ưu tiên'},
  {name:'Hoàng Nam',group:'Mới',order:'ST-1029',status:'Đang hoạt động'},
  {name:'Lead demo #01',group:'Tiềm năng',order:'Chưa mua',status:'Quan tâm VIP'},
 ]
 const visible=customers.filter((customer)=>{
  const segmentMatch=segment==='Tất cả'||customer.group===segment||customer.status===segment
  return segmentMatch&&normalizeSearch([customer.name,customer.group,customer.order,customer.status].join(' ')).includes(normalizeSearch(query).trim())
 })
 const segments=['Tất cả','VIP','Mới','Tiềm năng','Cần chăm sóc']
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">CUSTOMER SEGMENTS</p><h2>Quản lý khách hàng</h2><p>Tìm kiếm, phân nhóm khách hàng và lead để ưu tiên chăm sóc. Dữ liệu hiện là mẫu giao diện; form lead ngoài storefront chưa gửi backend.</p></div><span className="admin-preview-badge">{customers.length} khách demo</span></div>
   <div className="customer-segments">{segments.map((item)=><button key={item} type="button" className={segment===item?'is-active':''} onClick={()=>setSegment(item)}>{item}<span>{item==='Tất cả'?customers.length:customers.filter((customer)=>customer.group===item||customer.status===item).length}</span></button>)}</div>
   <div className="admin-module-toolbar"><label><span className="sr-only">Tìm khách hàng</span><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Tên, mã đơn, nhóm hoặc trạng thái…" /></label><span>{visible.length}/{customers.length} khách</span></div>
   <div className="customer-grid">{visible.map((customer)=><article key={customer.name}><div className="customer-avatar" aria-hidden="true">{customer.name.slice(0,1)}</div><div><b>{customer.name}</b><small>{customer.group} · {customer.order}</small></div><span>{customer.status}</span><button type="button" disabled title="Chưa nối backend khách hàng">Mở hồ sơ</button></article>)}{visible.length===0&&<p className="admin-empty">Không có khách hàng phù hợp.</p>}</div>
 </section>
}

function OrderTypesPreview(){
 const types=[
  {name:'Giao tiêu chuẩn',priority:'Bình thường',sla:'48h',status:'Bật',note:'Giao tận nơi theo vùng phục vụ'},
  {name:'Nhận tại cửa hàng',priority:'Cao',sla:'4h',status:'Bật',note:'Chờ xác nhận khả dụng tại chi nhánh'},
  {name:'Đơn quà tặng',priority:'Bình thường',sla:'72h',status:'Nháp',note:'Chưa bật cho khách hàng'},
 ]
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">ORDER WORKFLOWS</p><h2>Quản lý loại đơn hàng</h2><p>Thiết kế luồng xử lý, SLA và mức ưu tiên. Cấu hình bên dưới chưa được backend thực thi.</p></div><span className="admin-preview-badge">Cấu hình demo</span></div>
   <div className="order-type-grid">{types.map((type)=><article key={type.name}><div className="order-type-head"><span>{type.status}</span><b>{type.name}</b></div><p>{type.note}</p><dl><div><dt>Ưu tiên</dt><dd>{type.priority}</dd></div><div><dt>SLA</dt><dd>{type.sla}</dd></div></dl><button type="button" disabled>Chỉnh cấu hình</button></article>)}</div>
 </section>
}

function SupportQueuePreview(){
 const columns=[
  {title:'Mới',tone:'new',items:[['CS-300','Lê Hương','Sản phẩm']]},
  {title:'Đang xử lý',tone:'active',items:[['CS-301','Nguyễn An','Đơn hàng'],['CS-297','Hoàng Nam','Thanh toán']]},
  {title:'Đã xong',tone:'done',items:[['CS-298','Trần Minh','Địa chỉ']]},
 ]
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">CUSTOMER CARE QUEUE</p><h2>Quản lý chăm sóc khách hàng</h2><p>Hàng đợi trực quan theo trạng thái xử lý. Thao tác ticket vẫn là preview.</p></div><span className="admin-preview-badge">Queue demo</span></div>
   <div className="support-board">{columns.map((column)=><section key={column.title} className={'support-column support-column--'+column.tone}><header><b>{column.title}</b><span>{column.items.length}</span></header><div>{column.items.map(([id,customer,topic])=><article key={id}><b>{id}</b><span>{customer}</span><small>{topic}</small><button type="button" disabled>Mở ticket</button></article>)}</div></section>)}</div>
 </section>
}

function OvertimeRewardsPreview(){
 const requests=[
  {name:'Quốc Bảo',type:'Tăng ca',value:'2 giờ',status:'Chờ duyệt'},
  {name:'Mai Anh',type:'Khen thưởng',value:'120 điểm',status:'Đã duyệt'},
  {name:'Thùy Linh',type:'Tăng ca',value:'1.5 giờ',status:'Đã duyệt'},
 ]
 const pending=requests.filter((item)=>item.status==='Chờ duyệt').length
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">PEOPLE OPERATIONS</p><h2>Tăng ca & khen thưởng</h2><p>Theo dõi đề xuất OT và ghi nhận thành tích. Các nút duyệt chưa nối backend nhân sự.</p></div><span className="admin-preview-badge">{pending} chờ duyệt</span></div>
   <div className="people-summary"><div><small>Đề xuất hôm nay</small><strong>{requests.length}</strong></div><div><small>Chờ duyệt</small><strong>{pending}</strong></div><div><small>Đã xử lý</small><strong>{requests.length-pending}</strong></div></div>
   <div className="people-request-list">{requests.map((item)=><article key={item.name+item.type}><div><b>{item.name}</b><small>{item.type}</small></div><strong>{item.value}</strong><span>{item.status}</span><div><button type="button" disabled>Duyệt</button><button type="button" disabled>Từ chối</button></div></article>)}</div>
 </section>
}

export default function AdminModule({module}){
 const [filter,setFilter]=useState('')
 const data=datasets[module]||datasets.statistics
 const rows=useMemo(()=>{
   const needle=normalizeSearch(filter).trim()
   if(!needle)return data.rows
   return data.rows.filter((row)=>normalizeSearch(row.join(' ')).includes(needle))
 },[data,filter])
 if(module==='dashboard')return <Dashboard/>
 if(module==='customers')return <CustomersPreview/>
 if(module==='rewards-wheel')return <RewardsWheelPreview/>
 if(module==='appearance')return <AppearancePreview/>
 if(module==='staff')return <StaffAccessPreview/>
 if(module==='order-types')return <OrderTypesPreview/>
 if(module==='support')return <SupportQueuePreview/>
 if(module==='overtime')return <OvertimeRewardsPreview/>
 return <section className="admin-module-card">
   <div className="admin-module-head"><div><p className="admin-eyebrow">STORE OPERATIONS</p><h2>{data.title}</h2><p>{data.description}</p></div><button type="button" disabled title="Chưa nối backend">+ Tạo mới</button></div>
   <div className="admin-module-toolbar"><label><span className="sr-only">Lọc {data.title}</span><input type="search" value={filter} onChange={(event)=>setFilter(event.target.value)} placeholder="Lọc nhanh trong bảng…" /></label><span>{rows.length}/{data.rows.length} mục</span></div>
   <div className="admin-table-wrap"><table><caption className="sr-only">{data.title}</caption><thead><tr>{data.columns.map((column)=><th key={column}>{column}</th>)}<th>Thao tác</th></tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=><td className={cellIndex===row.length-1?'admin-status-cell':''} key={cell}>{cell}</td>)}<td><button className="table-action" type="button" disabled title="Chưa nối backend">Mở</button></td></tr>)}</tbody></table>{rows.length===0&&<p className="admin-empty">Không có mục nào khớp bộ lọc.</p>}</div>
   <p className="admin-demo-note">Dữ liệu trong module này hiện là dữ liệu giao diện mẫu; chưa ghi vào database nghiệp vụ.</p>
 </section>
}
