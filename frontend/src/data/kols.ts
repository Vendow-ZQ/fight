export interface KOL {
  id: string
  name: string
  title: string
  tags: string[]
  color: string
  bgColor: string
}

export const KOLS: KOL[] = [
  {
    id: 'hu_chenfeng',
    name: '胡陈峰',
    title: '互联网评论员',
    tags: ['科技趋势', '互联网思维', '批判性思考'],
    color: '#A855F7',
    bgColor: '#0D001A',
  },
  {
    id: 'feng_ge',
    name: '锋哥',
    title: '职场博主',
    tags: ['职场现实', '打工人视角', '反鸡汤'],
    color: '#00C8FF',
    bgColor: '#001A20',
  },
  {
    id: 'da_bing',
    name: '大兵',
    title: '作家 / 主持人',
    tags: ['人生规划', '直播连麦', '务实主义'],
    color: '#FFD700',
    bgColor: '#1A1500',
  },
  {
    id: 'zhang_xuefeng',
    name: '章雪风',
    title: '高考志愿填报导师',
    tags: ['实用主义', '就业导向', '寒门出身'],
    color: '#FF6B35',
    bgColor: '#1A0A00',
  },
  {
    id: 'changshu_arnold',
    name: '诺神',
    title: '体育健将',
    tags: ['健美之光', '诺言诺语', '三卡车'],
    color: '#22C55E',
    bgColor: '#001A0A',
  },
  {
    id: 'elon_musk',
    name: '马斯克',
    title: '科技狂人 / 火星教主',
    tags: ['第一性原理', '白痴指数', '快速迭代'],
    color: '#3B82F6',
    bgColor: '#000D1A',
  },
  {
    id: 'ilya_sutskever',
    name: '以利亚',
    title: 'AI先知 / SSI创始人',
    tags: ['压缩即理解', '安全超级智能', 'peak data'],
    color: '#8B5CF6',
    bgColor: '#0D0019',
  },
  {
    id: 'steve_jobs',
    name: '乔布斯',
    title: '产品之神',
    tags: ['聚焦即说不', '端到端控制', '现实扭曲力场'],
    color: '#E11D48',
    bgColor: '#1A0008',
  },
  {
    id: 'zhang_yiming',
    name: '张一鸣',
    title: '算法之王 / 字节创始人',
    tags: ['延迟满足', '信息效率', '逃逸平庸'],
    color: '#F97316',
    bgColor: '#1A0B00',
  },
  {
    id: 'karpathy',
    name: '卡帕西',
    title: 'AI教育家 / 工程现实主义者',
    tags: ['构建即理解', 'March of Nines', 'vibe coding'],
    color: '#06B6D4',
    bgColor: '#001217',
  },
]

export const TOPICS = [
  '内卷有没有意义？',
  'AI会不会取代人类？',
  '年轻人30岁前该不该买房？',
  '躺平是不是一种智慧？',
  '考研还是直接就业？',
  '出国留学值不值？',
  '… ?',
]
