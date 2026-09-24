export const demoVouchers = Object.freeze([
  { code: 'STORE50', label: 'Giảm 50K', type: 'amount', value: 50000, minSubtotal: 500000, tiers: ['standard','vip','elite'], description: 'Voucher demo cho đơn từ 500.000 ₫.' },
  { code: 'EVERYDAY10', label: 'Giảm 10%', type: 'percent', value: 10, maxDiscount: 100000, minSubtotal: 300000, tiers: ['standard','vip','elite'], description: 'Voucher demo giảm 10%, tối đa 100.000 ₫.' },
  { code: 'VIP100', label: 'VIP giảm 100K', type: 'amount', value: 100000, minSubtotal: 1000000, tiers: ['vip','elite'], description: 'Voucher demo cho thành viên VIP/Ưu tú.' },
  { code: 'ELITE15', label: 'Ưu tú giảm 15%', type: 'percent', value: 15, maxDiscount: 200000, minSubtotal: 1000000, tiers: ['elite'], description: 'Voucher demo dành cho thành viên Ưu tú.' },
])

export const membershipPlans = Object.freeze([
  { id:'standard', name:'Thành viên', price:0, badge:'EVERYDAY', description:'Tài khoản cơ bản cho trải nghiệm Store.', benefits:['Lưu giỏ hàng cục bộ','Theo dõi đơn demo','Voucher demo công khai'] },
  { id:'vip', name:'VIP', price:99000, badge:'VIP', description:'Gói thành viên trả phí mô phỏng cho prototype.', benefits:['Mở voucher VIP demo','Thêm lượt quay ưu đãi demo','Khu vực quyền lợi riêng'] },
  { id:'elite', name:'Ưu tú', price:199000, badge:'ELITE', description:'Gói cao nhất trong prototype trải nghiệm thành viên.', benefits:['Bao gồm quyền lợi VIP demo','Mở voucher Ưu tú demo','Ưu tiên hiển thị chiến dịch demo'] },
])

export function getMembershipPlan(id='standard') {
  return membershipPlans.find((plan)=>plan.id===id) || membershipPlans[0]
}

export function getVoucher(code='') {
  const normalized=String(code).trim().toUpperCase()
  return demoVouchers.find((voucher)=>voucher.code===normalized) || null
}

export function evaluateVoucher(code, subtotal, tier='standard') {
  const voucher=getVoucher(code)
  const amount=Math.max(0, Number(subtotal)||0)
  if(!voucher) return { valid:false, discount:0, reason:'Không tìm thấy voucher demo.' }
  if(!voucher.tiers.includes(tier)) return { valid:false, discount:0, reason:'Voucher này không dành cho hạng thành viên hiện tại.' }
  if(amount < voucher.minSubtotal) return { valid:false, discount:0, reason:'Chưa đạt giá trị đơn tối thiểu của voucher.' }
  const raw=voucher.type==='percent' ? amount * voucher.value / 100 : voucher.value
  const capped=voucher.maxDiscount ? Math.min(raw, voucher.maxDiscount) : raw
  return { valid:true, voucher, discount:Math.min(amount, Math.round(capped)), reason:'' }
}

export function availableVouchers(subtotal, tier='standard') {
  return demoVouchers.filter((voucher)=>evaluateVoucher(voucher.code,subtotal,tier).valid)
}

export function spinDemoReward(turn=0, tier='standard') {
  const base=['STORE50',null,'EVERYDAY10',null]
  const rewards=tier==='elite' ? [...base,'VIP100','ELITE15'] : tier==='vip' ? [...base,'VIP100'] : base
  const index=Math.abs(Number(turn)||0) % rewards.length
  const code=rewards[index]
  if(!code) return { kind:'message', title:'Gần trúng rồi!', message:'Lượt demo này chưa có voucher. Thử vòng tiếp theo.' }
  return { kind:'voucher', title:'Bạn nhận được '+code, voucher:getVoucher(code) }
}
