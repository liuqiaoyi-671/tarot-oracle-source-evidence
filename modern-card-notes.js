// Tina Gong / Labyrinthos：2026-10-06 核对。中文为编辑概括，不是原文译本。键为 DECK id。
const MODERN_CARD_NOTES = {
  "0": {
    "name": "愚者",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-fool-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "开启轻松互动",
      "work": "尝试新方向",
      "finance": "小额探索而非豪赌"
    },
    "rev": {
      "love": "自由与承诺失衡",
      "work": "停滞或仓促跳转",
      "finance": "冲动消费需节制"
    }
  },
  "1": {
    "name": "魔术师",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-magician-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "主动表达并兑现",
      "work": "把技能变成果",
      "finance": "寻找技能变现入口"
    },
    "rev": {
      "love": "表现与诚意落差",
      "work": "才能未被落实",
      "finance": "警惕包装与收益落差"
    }
  },
  "2": {
    "name": "女祭司",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-high-priestess-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "给感受留观察空间",
      "work": "先学习并核实信息",
      "finance": "保留隐私看清条款"
    },
    "rev": {
      "love": "沉默造成误解",
      "work": "信息隔离妨碍判断",
      "finance": "未知条件尚未厘清"
    }
  },
  "3": {
    "name": "女皇",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-empress-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "照顾滋养共同生活",
      "work": "创造有支持的环境",
      "finance": "资源充裕可合理分享"
    },
    "rev": {
      "love": "依赖与照顾失衡",
      "work": "创造力被惯性压住",
      "finance": "物质焦虑影响安排"
    }
  },
  "4": {
    "name": "皇帝",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-emperor-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "清晰边界稳定承诺",
      "work": "制度分工有助执行",
      "finance": "预算纪律建立安全感"
    },
    "rev": {
      "love": "控制欲压住平等",
      "work": "僵硬管理削弱效率",
      "finance": "失控或过度紧缩"
    }
  },
  "5": {
    "name": "教皇",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-hierophant-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "讨论共同价值与承诺",
      "work": "借助培训与导师",
      "finance": "稳健规则与机构参考"
    },
    "rev": {
      "love": "价值不合需重谈",
      "work": "惯例限制自主空间",
      "finance": "新方法须评估风险"
    }
  },
  "6": {
    "name": "恋人",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-lovers-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "互相选择价值一致",
      "work": "协作及职业抉择",
      "finance": "比较选项的代价"
    },
    "rev": {
      "love": "投入和价值不对等",
      "work": "合作目标不统一",
      "finance": "欲望干扰取舍"
    }
  },
  "7": {
    "name": "战车",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-chariot-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "主动推动但保留空间",
      "work": "集中目标推进",
      "finance": "围绕目标安排资源"
    },
    "rev": {
      "love": "强推使关系紧张",
      "work": "急躁或失去方向",
      "finance": "仓促决策阻碍计划"
    }
  },
  "8": {
    "name": "力量",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/strength-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "温和坚定处理分歧",
      "work": "自我管理支持突破",
      "finance": "克制欲望持续积累"
    },
    "rev": {
      "love": "自疑削弱表达",
      "work": "信心不足影响行动",
      "finance": "冲动与犹豫需校准"
    }
  },
  "9": {
    "name": "隐者",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-hermit-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "独处厘清关系需求",
      "work": "审视工作的意义",
      "finance": "审视物质与生活目标"
    },
    "rev": {
      "love": "隔离妨碍连接",
      "work": "孤立或方向待重评",
      "finance": "资源安排需回到现实"
    }
  },
  "10": {
    "name": "命运之轮",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-wheel-of-fortune-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "共同适应关系变化",
      "work": "留意阶段转换机会",
      "finance": "为波动留缓冲"
    },
    "rev": {
      "love": "外部变化扰动关系",
      "work": "旧办法难应新变化",
      "finance": "预备不可控支出"
    }
  },
  "11": {
    "name": "正义",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/justice-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "公平沟通承担责任",
      "work": "结果与责任相对应",
      "finance": "核对交换及账目"
    },
    "rev": {
      "love": "推责加剧不公平",
      "work": "流程或评价不公",
      "finance": "不透明交易需复核"
    }
  },
  "12": {
    "name": "倒吊人",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-hanged-man-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "暂停催促换个角度",
      "work": "等待时重估方法",
      "finance": "重新审视资源取舍"
    },
    "rev": {
      "love": "牺牲未换来进展",
      "work": "拖延或无效投入",
      "finance": "卡在取舍难落实"
    }
  },
  "13": {
    "name": "死神",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/death-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "关系模式进入转化",
      "work": "结束阶段转向新路径",
      "finance": "变化后调整收支"
    },
    "rev": {
      "love": "害怕变化维持惯性",
      "work": "负面模式难退出",
      "finance": "旧习惯妨碍适应"
    }
  },
  "14": {
    "name": "节制",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/temperance-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "协调节奏逐步靠近",
      "work": "适度持续推进",
      "finance": "稳步储蓄平衡收支"
    },
    "rev": {
      "love": "冷热极端难协调",
      "work": "工作生活失衡",
      "finance": "短期欲望打乱预算"
    }
  },
  "15": {
    "name": "恶魔",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-devil-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "依赖与欲望需辨认",
      "work": "辨认受困的代价",
      "finance": "识别损害资源的习惯"
    },
    "rev": {
      "love": "重建自主与边界",
      "work": "开始承担改变责任",
      "finance": "摆脱消耗性习惯"
    }
  },
  "16": {
    "name": "塔",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-tower-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "基础动摇需诚实面对",
      "work": "原有结构受冲击",
      "finance": "为突发损失预留空间"
    },
    "rev": {
      "love": "修补或回避根本矛盾",
      "work": "调整后仍须检视根因",
      "finance": "防止风险再度累积"
    }
  },
  "17": {
    "name": "星星",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-star-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "恢复信任与希望",
      "work": "重新连接工作热情",
      "finance": "建立可持续目标"
    },
    "rev": {
      "love": "失望遮住已有支持",
      "work": "动力低落待修复",
      "finance": "悲观影响长期安排"
    }
  },
  "18": {
    "name": "月亮",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-moon-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "关系信息模糊待澄清",
      "work": "职责信息未明",
      "finance": "条款与风险看不清"
    },
    "rev": {
      "love": "迷雾渐散或恐惧加深",
      "work": "核实信息辨别误解",
      "finance": "澄清账目仍需证据"
    }
  },
  "19": {
    "name": "太阳",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-sun-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "坦诚愉悦共享成果",
      "work": "自信带来可见进展",
      "finance": "成果改善资源状况"
    },
    "rev": {
      "love": "忽略快乐或期待过高",
      "work": "过度自信忽视细节",
      "finance": "乐观估算需核实"
    }
  },
  "20": {
    "name": "审判",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/judgement-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "回顾关系决定下一步",
      "work": "总结责任与职业方向",
      "finance": "复盘旧有金钱习惯"
    },
    "rev": {
      "love": "责备阻碍反思",
      "work": "自疑或回避责任",
      "finance": "不吸取经验反复失误"
    }
  },
  "21": {
    "name": "世界",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/the-world-meaning-major-arcana-tarot-card-meanings",
    "up": {
      "love": "阶段圆满进入新阶段",
      "work": "完成项目整合成果",
      "finance": "阶段目标实现"
    },
    "rev": {
      "love": "缺乏收尾与满足感",
      "work": "目标不清成果未整合",
      "finance": "接近目标仍有缺口"
    }
  },
  "22": {
    "name": "权杖A",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ace-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "热情开启新互动",
      "work": "创意转为新项目",
      "finance": "探索新收入思路"
    },
    "rev": {
      "love": "激情短暂缺少落实",
      "work": "动力与方向不足",
      "finance": "冒险前先算成本"
    }
  },
  "23": {
    "name": "权杖二",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/two-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "讨论共同未来",
      "work": "规划路径与资源",
      "finance": "制定长期预算"
    },
    "rev": {
      "love": "未来计划难对齐",
      "work": "过度分析迟迟不动",
      "finance": "规划不足拖累安排"
    }
  },
  "24": {
    "name": "权杖三",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/three-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "关系向外拓展",
      "work": "拓展合作与市场",
      "finance": "扩大目标并等待回报"
    },
    "rev": {
      "love": "进展受阻需协调",
      "work": "扩张延误检视条件",
      "finance": "资金回流可能滞后"
    }
  },
  "25": {
    "name": "权杖四",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/four-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "共同庆祝建立归属",
      "work": "团队支持稳固基础",
      "finance": "稳定资源支持家人"
    },
    "rev": {
      "love": "家庭与承诺期待冲突",
      "work": "同事摩擦影响协作",
      "finance": "支持他人造成负担"
    }
  },
  "26": {
    "name": "权杖五",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/five-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "分歧需要协商",
      "work": "竞争激发也消耗精力",
      "finance": "金钱分配存在争议"
    },
    "rev": {
      "love": "解决冲突或压抑分歧",
      "work": "减少争执重建规则",
      "finance": "资源冲突缓和或升级"
    }
  },
  "27": {
    "name": "权杖六",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/six-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "努力得到认可",
      "work": "成果可见获得肯定",
      "finance": "劳动回报改善资源"
    },
    "rev": {
      "love": "认可需求未被满足",
      "work": "贡献未被看见",
      "finance": "回报不如预期"
    }
  },
  "28": {
    "name": "权杖七",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/seven-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "守住边界应对挑战",
      "work": "维护成果与立场",
      "finance": "保护既有资源"
    },
    "rev": {
      "love": "防守疲惫或退让",
      "work": "压力使坚持难持续",
      "finance": "防线过紧或无力维持"
    }
  },
  "29": {
    "name": "权杖八",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/eight-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "互动加速及时沟通",
      "work": "任务迅速推进",
      "finance": "注意现金流速度"
    },
    "rev": {
      "love": "消息误解或节奏失配",
      "work": "延迟及任务过载",
      "finance": "流动减慢避免催促决策"
    }
  },
  "30": {
    "name": "权杖九",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/nine-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "谨慎坚持也需休整",
      "work": "接近完成仍有压力",
      "finance": "短期紧张需缓冲"
    },
    "rev": {
      "love": "单方坚持已显疲惫",
      "work": "耗竭妨碍收尾",
      "finance": "压力下回避资源问题"
    }
  },
  "31": {
    "name": "权杖十",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ten-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "责任压过轻松相处",
      "work": "任务过重应重分配",
      "finance": "固定支出形成负担"
    },
    "rev": {
      "love": "分担责任或拒绝求助",
      "work": "学会交接防止耗竭",
      "finance": "求助重组或负担累加"
    }
  },
  "32": {
    "name": "权杖侍从",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/page-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "轻松探索新互动",
      "work": "学习新项目保持好奇",
      "finance": "小额资源可试验"
    },
    "rev": {
      "love": "热情无方向难承诺",
      "work": "乏味削弱行动",
      "finance": "冲动支出破坏稳定"
    }
  },
  "33": {
    "name": "权杖骑士",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/knight-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "热烈推进但检视承诺",
      "work": "大胆行动带动进展",
      "finance": "流动支出须计划"
    },
    "rev": {
      "love": "急进与反复影响信任",
      "work": "无序行动难持续",
      "finance": "过度自信造成浪费"
    }
  },
  "34": {
    "name": "权杖女王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/queen-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "自信温暖保持独立",
      "work": "激励协作主动执行",
      "finance": "有把握地管理资源"
    },
    "rev": {
      "love": "嫉妒与要求压住空间",
      "work": "动力低落影响协作",
      "finance": "用消费补偿不安"
    }
  },
  "35": {
    "name": "权杖国王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/king-of-wands-meaning-tarot-card-meanings",
    "up": {
      "love": "主动表达带领关系",
      "work": "领导与指导推动合作",
      "finance": "目标管理兼顾分享"
    },
    "rev": {
      "love": "支配或消极失去平衡",
      "work": "缺少有效领导",
      "finance": "目标缺失或管理被动"
    }
  },
  "36": {
    "name": "圣杯A",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ace-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "开放感受建立亲近",
      "work": "友好协作激发创作",
      "finance": "借助支持探索收入"
    },
    "rev": {
      "love": "脆弱感妨碍连接",
      "work": "缺乏情感投入与支持",
      "finance": "失望影响资源判断"
    }
  },
  "37": {
    "name": "圣杯二",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/two-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "平等回应共同合作",
      "work": "伙伴优势形成互补",
      "finance": "交换与收支较平衡"
    },
    "rev": {
      "love": "依赖或投入不对等",
      "work": "伙伴摩擦需重谈",
      "finance": "支出超过可承受水平"
    }
  },
  "38": {
    "name": "圣杯三",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/three-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "社交支持增进连接",
      "work": "团队庆祝增强合作",
      "finance": "社交开支与成果分享"
    },
    "rev": {
      "love": "群体期待干扰关系",
      "work": "团队活动与氛围失调",
      "finance": "人情消费超过能力"
    }
  },
  "39": {
    "name": "圣杯四",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/four-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "倦怠使回应减少",
      "work": "对现职失去兴趣",
      "finance": "比较心遮住资源价值"
    },
    "rev": {
      "love": "重新发现连接可能",
      "work": "新灵感促使调整",
      "finance": "主动改善资源安排"
    }
  },
  "40": {
    "name": "圣杯五",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/five-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "失落中辨认剩余支持",
      "work": "挫折后清点可用能力",
      "finance": "损失后仍有可保留部分"
    },
    "rev": {
      "love": "逐渐放下失落",
      "work": "从失误恢复并找新方向",
      "finance": "重新建立安全缓冲"
    }
  },
  "41": {
    "name": "圣杯六",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/six-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "熟悉记忆带来温暖",
      "work": "从旧经验吸取教训",
      "finance": "支持与资源分享"
    },
    "rev": {
      "love": "过去妨碍当下连接",
      "work": "舒适区与旧模式待更新",
      "finance": "独立管理资源"
    }
  },
  "42": {
    "name": "圣杯七",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/seven-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "想象与选择需要验证",
      "work": "多种职业方向需筛选",
      "finance": "机会多也需查风险"
    },
    "rev": {
      "love": "减少幻想或仍逃避选择",
      "work": "收敛目标避免分散",
      "finance": "厘清目标防止分心"
    }
  },
  "43": {
    "name": "圣杯八",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/eight-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "评估不满足是否值得继续",
      "work": "重估工作意义与投入",
      "finance": "在安全感与满足间取舍"
    },
    "rev": {
      "love": "害怕变化而留下",
      "work": "惯性维持不满意状态",
      "finance": "偏重安全感需看代价"
    }
  },
  "44": {
    "name": "圣杯九",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/nine-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "欣赏当下的满足",
      "work": "成果带来认可",
      "finance": "资源舒适可享受"
    },
    "rev": {
      "love": "表面满足缺乏连接",
      "work": "理想岗位与现实落差",
      "finance": "目标回报未兑现"
    }
  },
  "45": {
    "name": "圣杯十",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ten-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "共同生活带来归属",
      "work": "互相支持的环境",
      "finance": "足够感与长期稳定"
    },
    "rev": {
      "love": "外部期待与内部分歧",
      "work": "团队紧张缺乏归属",
      "finance": "家庭金钱安排冲突"
    }
  },
  "46": {
    "name": "圣杯侍从",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/page-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "好奇温柔表达感受",
      "work": "创意萌芽需落地",
      "finance": "愿景需要行动配套"
    },
    "rev": {
      "love": "敏感与不成熟妨碍表达",
      "work": "创作受情绪影响",
      "finance": "回避账目难落实计划"
    }
  },
  "47": {
    "name": "圣杯骑士",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/knight-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "浪漫表达也看行动",
      "work": "以沟通协调合作",
      "finance": "创意协调资源争议"
    },
    "rev": {
      "love": "回避冲突与情绪反复",
      "work": "情绪化妨碍协作",
      "finance": "逃避决策带来失落"
    }
  },
  "48": {
    "name": "圣杯女王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/queen-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "倾听照顾加深连接",
      "work": "提供与接受支持",
      "finance": "用资源照顾他人"
    },
    "rev": {
      "love": "付出失衡缺少边界",
      "work": "照顾他人耗尽自己",
      "finance": "过度给予损害自身"
    }
  },
  "49": {
    "name": "圣杯国王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/king-of-cups-meaning-tarot-card-meanings",
    "up": {
      "love": "感受与理性共同决策",
      "work": "稳住情绪协调需求",
      "finance": "现实判断保持希望"
    },
    "rev": {
      "love": "操纵与自利风险需核实",
      "work": "情绪需求长期被忽略",
      "finance": "情绪驱动消费失控"
    }
  },
  "50": {
    "name": "宝剑A",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ace-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "坦诚交流直面问题",
      "work": "清晰沟通集中重点",
      "finance": "理性比较资源方案"
    },
    "rev": {
      "love": "措辞伤人观点冲突",
      "work": "表达不清任务失焦",
      "finance": "核对账单与条款"
    }
  },
  "51": {
    "name": "宝剑二",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/two-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "两难暂缓但需补信息",
      "work": "路径或立场需要取舍",
      "finance": "回避决策信息不全"
    },
    "rev": {
      "love": "僵局松动也可能更难选",
      "work": "艰难取舍需看代价",
      "finance": "面对账目实际情况"
    }
  },
  "52": {
    "name": "宝剑三",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/three-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "分歧与受伤需要面对",
      "work": "冲突影响工作状态",
      "finance": "损失或资源拆分"
    },
    "rev": {
      "love": "修复伤痛或结束争执",
      "work": "改进流程避免重演",
      "finance": "逐步恢复或仍受损失困扰"
    }
  },
  "53": {
    "name": "宝剑四",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/four-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "留空间休息整理思绪",
      "work": "暂歇恢复工作能力",
      "finance": "暂停焦虑梳理账目"
    },
    "rev": {
      "love": "恢复联系或仍然耗竭",
      "work": "休息不足与恢复并存",
      "finance": "接受支持减少压力"
    }
  },
  "54": {
    "name": "宝剑五",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/five-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "争输赢损害连接",
      "work": "敌意与防御消耗团队",
      "finance": "资源争执警惕被利用"
    },
    "rev": {
      "love": "和解或遗留怨怼",
      "work": "坦诚协商检视后续风险",
      "finance": "缓和争执重建交换"
    }
  },
  "55": {
    "name": "宝剑六",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/six-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "离开冲突走向缓和",
      "work": "转向较少压力的环境",
      "finance": "从经验恢复稳定"
    },
    "rev": {
      "love": "旧事牵制难过渡",
      "work": "受困或反复制造冲突",
      "finance": "拖延处理资源问题"
    }
  },
  "56": {
    "name": "宝剑七",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/seven-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "策略与透明度需审视",
      "work": "独立策略也需核实信息",
      "finance": "不透明条件须查证"
    },
    "rev": {
      "love": "坦白或继续回避责任",
      "work": "调整方式承担后果",
      "finance": "厘清隐性成本与责任"
    }
  },
  "57": {
    "name": "宝剑八",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/eight-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "受限感压住主动性",
      "work": "担心改变而依赖现职",
      "finance": "焦虑使选项看不清"
    },
    "rev": {
      "love": "逐步看见可行动空间",
      "work": "挣脱限制或仍需支持",
      "finance": "减轻焦虑回到实际数字"
    }
  },
  "58": {
    "name": "宝剑九",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/nine-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "担忧不等于事实",
      "work": "压力占据注意力",
      "finance": "焦虑放大匮乏感"
    },
    "rev": {
      "love": "分享担忧或压力持续",
      "work": "获得支持厘清压力",
      "finance": "厘清情况与实际缺口"
    }
  },
  "59": {
    "name": "宝剑十",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ten-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "痛苦阶段需要收尾",
      "work": "压力累积达到限度",
      "finance": "损失后及时止损重整"
    },
    "rev": {
      "love": "开始恢复仍需面对结束",
      "work": "转向压力较小路径",
      "finance": "避免扩大损失逐步修复"
    }
  },
  "60": {
    "name": "宝剑侍从",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/page-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "通过交流认识彼此",
      "work": "学习调查新方向",
      "finance": "先研究收入办法"
    },
    "rev": {
      "love": "防御争辩妨碍交流",
      "work": "方向不稳与流言干扰",
      "finance": "研究过多行动不足"
    }
  },
  "61": {
    "name": "宝剑骑士",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/knight-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "直接沟通也顾及感受",
      "work": "集中执行快速推进",
      "finance": "围绕目标采取行动"
    },
    "rev": {
      "love": "强硬争执压住尊重",
      "work": "急进或傲慢损害合作",
      "finance": "强迫与可疑条款需核实"
    }
  },
  "62": {
    "name": "宝剑女王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/queen-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "独立判断清晰边界",
      "work": "建设性反馈与专业指导",
      "finance": "理性梳理资源"
    },
    "rev": {
      "love": "旧伤影响判断与措辞",
      "work": "苛责妨碍合作",
      "finance": "情绪遮住逻辑"
    }
  },
  "63": {
    "name": "宝剑国王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/king-of-swords-meaning-tarot-card-meanings",
    "up": {
      "love": "以标准与理性谈承诺",
      "work": "客观标准推动成长",
      "finance": "纪律支持长期管理"
    },
    "rev": {
      "love": "控制与双重标准",
      "work": "权力欲影响客观判断",
      "finance": "失去纪律决策失真"
    }
  },
  "64": {
    "name": "星币A",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ace-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "稳定投入建立基础",
      "work": "现实机会开始成形",
      "finance": "为未来建立资源基础"
    },
    "rev": {
      "love": "物质压力影响稳定",
      "work": "机会失落或投入错位",
      "finance": "匮乏感下需审视决策"
    }
  },
  "65": {
    "name": "星币二",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/two-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "协调时间与关系需求",
      "work": "灵活调配多个任务",
      "finance": "按优先级处理收支"
    },
    "rev": {
      "love": "忙乱使关系被忽略",
      "work": "任务太多产生遗漏",
      "finance": "账单超出调度能力"
    }
  },
  "66": {
    "name": "星币三",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/three-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "共同解决实际问题",
      "work": "不同技能互补协作",
      "finance": "学习并寻求预算建议"
    },
    "rev": {
      "love": "分工失衡沟通受阻",
      "work": "合作摩擦拖累质量",
      "finance": "缺少学习规划"
    }
  },
  "67": {
    "name": "星币四",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/four-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "安全感与占有需平衡",
      "work": "保护位置但避免封闭",
      "finance": "储蓄与保守管理"
    },
    "rev": {
      "love": "放松控制或失去边界",
      "work": "分享资源也注意风险",
      "finance": "分享或花费需有预算"
    }
  },
  "68": {
    "name": "星币五",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/five-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "疏离时寻找可用支持",
      "work": "困难中避免自我隔离",
      "finance": "短缺压力需要求助"
    },
    "rev": {
      "love": "重新开放接受支持",
      "work": "困难缓解恢复合作",
      "finance": "恢复储蓄逐步处理负担"
    }
  },
  "69": {
    "name": "星币六",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/six-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "互相支持也看平等",
      "work": "帮助与指导形成合作",
      "finance": "接受或提供合理支持"
    },
    "rev": {
      "love": "援助附带控制条件",
      "work": "交换条件与权力失衡",
      "finance": "审视借款赠与附加条件"
    }
  },
  "70": {
    "name": "星币七",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/seven-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "持续经营观察回应",
      "work": "评估阶段投入产出",
      "finance": "耐心积累定期复盘"
    },
    "rev": {
      "love": "投入未获回应需重评",
      "work": "努力无进展检视方法",
      "finance": "回报偏低考虑调整"
    }
  },
  "71": {
    "name": "星币八",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/eight-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "持续用行动经营",
      "work": "练习技能提高质量",
      "finance": "劳动积累支持独立"
    },
    "rev": {
      "love": "投入不足忽略相处",
      "work": "重复劳动缺乏质量",
      "finance": "疏忽管理或超支"
    }
  },
  "72": {
    "name": "星币九",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/nine-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "独立与亲密可共存",
      "work": "努力获得成果",
      "finance": "积累带来自主空间"
    },
    "rev": {
      "love": "防御亲密或迷恋表象",
      "work": "求捷径或工作失衡",
      "finance": "冲动享受侵蚀积累"
    }
  },
  "73": {
    "name": "星币十",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/ten-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "讨论长期生活安排",
      "work": "建立可持续职业基础",
      "finance": "长期资源与家庭安排"
    },
    "rev": {
      "love": "家庭期待影响关系",
      "work": "组织基础不稳",
      "finance": "家庭利益与负担冲突"
    }
  },
  "74": {
    "name": "星币侍从",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/page-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "稳定认真逐步靠近",
      "work": "学习训练落实计划",
      "finance": "建立日常管理习惯"
    },
    "rev": {
      "love": "承诺缺少行动",
      "work": "想要成果却逃避练习",
      "finance": "管理疏忽带来不安"
    }
  },
  "75": {
    "name": "星币骑士",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/knight-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "可靠投入但避免僵化",
      "work": "稳定执行持续推进",
      "finance": "保守积累逐步增长"
    },
    "rev": {
      "love": "单调或忽略陪伴",
      "work": "过度工作或缺乏动力",
      "finance": "冲动花费打乱积累"
    }
  },
  "76": {
    "name": "星币女王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/queen-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "现实照顾营造舒适",
      "work": "务实经营支持他人",
      "finance": "负责地照料资源"
    },
    "rev": {
      "love": "物质期待盖过关心",
      "work": "经营失当协作不可靠",
      "finance": "囤积或管理失衡"
    }
  },
  "77": {
    "name": "星币国王",
    "source": "https://labyrinthos.co/blogs/tarot-card-meanings-list/king-of-pentacles-meaning-tarot-card-meanings",
    "up": {
      "love": "稳定承诺与实际支持",
      "work": "经验声誉带动发展",
      "finance": "长期积累兼顾分享"
    },
    "rev": {
      "love": "用资源控制关系",
      "work": "声誉与经营受损",
      "finance": "错误决策及吝啬失衡"
    }
  }
};
