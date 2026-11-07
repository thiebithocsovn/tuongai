/* TN3-V2 prototype. ALL numbers below are HYPOTHETICAL target-design assumptions.
 * NOT fitted to 45 human cases. NOT valid for substantive cause inference.
 * Replace only after independent teacher labels and a separate calibration sample.
 */
(function(root) {
  'use strict';
  const prior={
    DH01:[0.52,0.26,0.22],DH02:[0.38,0.36,0.26],
    DH03:[0.47,0.32,0.21],DH04:[0.43,0.35,0.22]
  }; // Original MC02 02/11/2026 design priors, kept for audit.
  function matrix(diag, off) {
    return [0,1,2].map(i=>[0,1,2].map(j=>i===j?diag:off)
      .concat([Number((1-diag-2*off).toFixed(9))]));
  }
  const quality=[[0.78,0.08],[0.74,0.085],[0.61,0.105]];
  const source={
    DH01:{
      name:'Nhầm bậc đơn thức',
      causes:['Lấy số mũ lớn nhất thay vì tổng','Nhầm bậc với hệ số/phần biến','Biết quy tắc nhưng ghi/chép nhầm'],
      questions:[
        'Với 4a³b², em xác định bậc thế nào? Ghi rõ những số nào đã cộng và vì sao.',
        'Với −7x²y, em xác định hệ số, phần biến và bậc. Giải thích vì sao hệ số không tính vào bậc.',
        'So sánh bậc của x²y và xy² và tự kiểm tra từng bước.'
      ],
      rubrics:['r1: chỉ lấy mũ lớn nhất','r2: dựa vào hệ số hay nhầm phần biến','r3: tính đúng khi kiểm tra; lỗi gốc có thể do sơ suất','U: phản hồi không phân biệt được']
    },
    DH02:{
      name:'Thiếu hạng tử giữa bình phương tổng',
      causes:['Chưa hiểu khai triển tích hai ngoặc','Nhầm công thức bình phương tích với tổng','Biết công thức nhưng sơ suất bỏ hạng tử'],
      questions:[
        'Viết (x + 2)(x + 2) thành bốn tích thành phần và thu gọn, giải thích hai tích chéo.',
        'Đánh giá câu (a+b)²=a²+b²; nếu sai hãy giải thích bằng quy tắc nhân hai ngoặc.',
        'Tự kiểm tra (u+v)² với u=1, v=2; nói rõ bước nào có thể bị bỏ sót.'
      ],
      rubrics:['r1: sai ở phân phối hai ngoặc','r2: áp dụng công thức của tích cho tổng','r3: tự chỉ ra sơ suất dù nắm phương pháp','U: không phân biệt được']
    },
    DH03:{
      name:'Sai dấu khi bỏ ngoặc/biến đổi',
      causes:['Không vững quy tắc nhân các dấu','Sai khi xử lý dấu trừ trước ngoặc','Đúng quy tắc nhưng chép/ghi nhầm dấu'],
      questions:[
        'Tính (−2)(−3) và (−2)·3; giải thích dấu trước khi viết kết quả.',
        'Bỏ ngoặc −(x²−6x), giải thích vì sao mỗi hạng tử đổi hoặc giữ dấu.',
        'Khai triển −x(x−6) và dùng phép thế x=2 để tự kiểm tra.'
      ],
      rubrics:['r1: xử lý quy tắc nhân dấu sai','r2: đổi dấu cả ngoặc không đúng','r3: tự phát hiện sơ suất trình bày','U: chưa phân biệt được']
    },
    DH04:{
      name:'Nhầm hệ số đơn thức',
      causes:['Gộp một phần biến vào hệ số','Bỏ dấu âm trong hệ số','Đúng khái niệm nhưng sơ suất chép/ghi'],
      questions:[
        'Trong −6a²b, hãy tách hệ số và phần biến. Giải thích vì sao −6b không phải hệ số.',
        'Hệ số của −5x²y, +5x²y và −(−5)x²y là gì? Nêu lý do cho từng dấu.',
        'Tự kiểm tra hệ số trong −3x²y và −3x²z, giải thích xem đổi biến có đổi hệ số không.'
      ],
      rubrics:['r1: gộp phần biến vào hệ số','r2: bỏ hoặc đổi dấu âm của hệ số','r3: tự giải thích đúng và có dấu hiệu sơ suất','U: chưa đủ căn cứ']
    }
  };
  const MODELS={};
  for(const dh of Object.keys(source)) {
    const cfg=source[dh];
    MODELS[dh]={
      dh,name:cfg.name,causes:cfg.causes,prior:prior[dh],
      calibrationStatus:'GIẢ ĐỊNH, CHƯA ĐO TỪ HỌC SINH',
      questions:cfg.questions.map((text,i)=>({
        id:'q'+(i+1),text,rates:matrix(quality[i][0],quality[i][1])
      })),
      rubrics:cfg.rubrics
    };
  }
  if(typeof module!=='undefined' && module.exports)module.exports=MODELS;
  if(root)root.TN3V2_MODELS=MODELS;
})(typeof window!=='undefined'?window:null);
