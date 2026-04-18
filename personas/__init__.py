from .hu_chenfeng import HU_CHENFENG
from .feng_ge import FENG_GE
from .zhang_xuefeng import ZHANG_XUEFENG
from .da_bing import DA_BING
from .changshu_arnold import CHANGSHU_ARNOLD
from .elon_musk import ELON_MUSK
from .ilya_sutskever import ILYA_SUTSKEVER
from .steve_jobs import STEVE_JOBS
from .zhang_yiming import ZHANG_YIMING
from .karpathy import KARPATHY

PERSONAS: dict[str, dict] = {
    "hu_chenfeng": HU_CHENFENG,
    "feng_ge": FENG_GE,
    "zhang_xuefeng": ZHANG_XUEFENG,
    "da_bing": DA_BING,
    "changshu_arnold": CHANGSHU_ARNOLD,
    "elon_musk": ELON_MUSK,
    "ilya_sutskever": ILYA_SUTSKEVER,
    "steve_jobs": STEVE_JOBS,
    "zhang_yiming": ZHANG_YIMING,
    "karpathy": KARPATHY,
}

KOL_META: dict[str, dict] = {
    "hu_chenfeng": {"title": "互联网评论员", "tags": ["科技趋势", "互联网思维", "批判性思考"], "color": "#A855F7", "bgColor": "#0D001A"},
    "feng_ge": {"title": "职场博主", "tags": ["职场现实", "打工人视角", "反鸡汤"], "color": "#00C8FF", "bgColor": "#001A20"},
    "zhang_xuefeng": {"title": "高考志愿填报导师", "tags": ["实用主义", "就业导向", "寒门出身"], "color": "#FF6B35", "bgColor": "#1A0A00"},
    "da_bing": {"title": "作家 / 主持人", "tags": ["人生规划", "直播连麦", "务实主义"], "color": "#FFD700", "bgColor": "#1A1500"},
    "changshu_arnold": {"title": "体育健将", "tags": ["健美之光", "诺言诺语", "三卡车"], "color": "#22C55E", "bgColor": "#001A0A"},
    "elon_musk": {"title": "科技狂人 / 火星教主", "tags": ["第一性原理", "白痴指数", "快速迭代"], "color": "#3B82F6", "bgColor": "#000D1A"},
    "ilya_sutskever": {"title": "AI先知 / SSI创始人", "tags": ["压缩即理解", "安全超级智能", "peak data"], "color": "#8B5CF6", "bgColor": "#0D0019"},
    "steve_jobs": {"title": "产品之神", "tags": ["聚焦即说不", "端到端控制", "现实扭曲力场"], "color": "#E11D48", "bgColor": "#1A0008"},
    "zhang_yiming": {"title": "算法之王 / 字节创始人", "tags": ["延迟满足", "信息效率", "逃逸平庸"], "color": "#F97316", "bgColor": "#1A0B00"},
    "karpathy": {"title": "AI教育家 / 工程现实主义者", "tags": ["构建即理解", "March of Nines", "vibe coding"], "color": "#06B6D4", "bgColor": "#001217"},
}

DISTILL_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#14b8a6", "#8b5cf6", "#ef4444", "#06b6d4"]
_color_idx = 0


def add_persona(kol_id: str, name: str, system_prompt: str, title: str = "", tags: list[str] | None = None, color: str = "") -> dict:
    global _color_idx
    PERSONAS[kol_id] = {"name": name, "system_prompt": system_prompt}
    if not color:
        color = DISTILL_COLORS[_color_idx % len(DISTILL_COLORS)]
        _color_idx += 1
    r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
    bg_color = f"#{r // 10:02x}{g // 10:02x}{b // 10:02x}"
    meta = {"title": title or "蒸馏博主", "tags": tags or [], "color": color, "bgColor": bg_color}
    KOL_META[kol_id] = meta
    return {"id": kol_id, "name": name, **meta}
