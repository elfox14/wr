import os

script_path = 'scripts/update_articles.py'

with open(script_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Apply replacements:

# 1. Set beginners-guide as featured and top-3-teams as false
# Let's locate beginners-guide featured: false and make it featured: true
content = content.replace(
    'id: "beginners-guide",\n    title: "دليل المبتدئ الشامل: كيف تبدأ في MC PRIME Exchange وتبني محفظتك الأولى في أقل من 10 دقائق؟",\n    excerpt: "إذا كنت جديداً على منصة MC PRIME Exchange ولا تعرف من أين تبدأ، فهذا المقال مكتوب لك. نشرح لك خطوة بخطوة كيف تفهم المنصة، تبني محفظتك الأولى، وتبدأ في الاستمتاع بتجربة التداول الافتراضي خلال كأس العالم 2026.",\n    content: `',
    'id: "beginners-guide",\n    title: "دليل المبتدئ الشامل: كيف تبدأ في MC PRIME Exchange وتبني محفظتك الأولى في أقل من 10 دقائق؟",\n    excerpt: "إذا كنت جديداً على منصة MC PRIME Exchange ولا تعرف من أين تبدأ، فهذا المقال مكتوب لك. نشرح لك خطوة بخطوة كيف تفهم المنصة، تبني محفظتك الأولى، وتبدأ في الاستمتاع بتجربة التداول الافتراضي خلال كأس العالم 2026.",\n    content: `'
)
# Let's target beginners-guide featured block directly:
old_bg_block = """    category: "دليل المبتدئين",
    readingTime: "6 دقائق",
    level: "beginner",
    tags: ["دليل المبتدئين", "بداية سريعة", "MC PRIME"],
    featured: false"""

new_bg_block = """    category: "دليل المبتدئين",
    readingTime: "6 دقائق",
    level: "beginner",
    tags: ["دليل المبتدئين", "بداية سريعة", "MC PRIME"],
    featured: true"""

content = content.replace(old_bg_block, new_bg_block)

# 2. Add relatedAssets variations for teams
content = content.replace(
    'relatedAssets: ["team-arg", "team-fra", "team-bra"]',
    'relatedAssets: ["team-ar", "team-arg", "team-fr", "team-fra", "team-br", "team-bra"]'
)

# 3. Add relatedAssets variations for players
content = content.replace(
    'relatedAssets: ["player-fra-3374", "player-eng-125010", "player-bra-1556"]',
    'relatedAssets: ["player-fra-3374", "player-fr-km10", "player-eng-125010", "player-bra-1556"]'
)

# 4. Add relatedAssets to injuries article
# Let's locate:
#     category: "أخبار السوق",
#     readingTime: "5 دقائق",
#     level: "intermediate",
#     tags: ["أخبار السوق", "إصابات اللاعبين", "تحركات الأسعار"],
#     featured: false
#   },
old_injuries_end = """    category: "أخبار السوق",
    readingTime: "5 دقائق",
    level: "intermediate",
    tags: ["أخبار السوق", "إصابات اللاعبين", "تحركات الأسعار"],
    featured: false
  },"""

new_injuries_end = """    category: "أخبار السوق",
    readingTime: "5 دقائق",
    level: "intermediate",
    tags: ["أخبار السوق", "إصابات اللاعبين", "تحركات الأسعار"],
    featured: false,
    relatedAssets: ["player-fra-3374", "player-fr-km10", "player-eng-125010", "player-bra-1556", "team-ar", "team-arg", "team-fr", "team-fra", "team-br", "team-bra"]
  },"""

content = content.replace(old_injuries_end, new_injuries_end)

# 5. Fix real-money-like wording & titles
# Replace "لمضاعفة أرباحك" with "لتحسين أداء محفظتك الافتراضية" in titles
content = content.replace(
    'title: "من المبتدئ إلى المحترف: استراتيجيات تداول متقدمة لمضاعفة أرباحك الافتراضية في MC PRIME Exchange",',
    'title: "من المبتدئ إلى المحترف: استراتيجيات تداول متقدمة لتحسين أداء محفظتك الافتراضية في MC PRIME Exchange",'
)
content = content.replace('لمضاعفة أرباحك الافتراضية', 'لتحسين أداء محفظتك الافتراضية')

# Wording cleanups:
content = content.replace('استثمار طويل الأمد نسبياً', 'تداول افتراضي طويل الأمد نسبياً')
content = content.replace('كيف توزع استثمارك بين الدفاع والهجوم؟', 'كيف توزع محفظتك الافتراضية بين الدفاع والهجوم؟')
content = content.replace('قرارك الاستثماري', 'قرارك التداولي الافتراضي')
content = content.replace('لإعادة استثماره في الأصول الأقوى', 'لإعادة تداوله افتراضياً في الأصول الأقوى')
content = content.replace('دون الحاجة لأي استثمار مالي حقيقي', 'دون الحاجة لأي مخاطرة مالية حقيقية')
content = content.replace('نصيحة استثمارية فعيلة', 'نصيحة استثمارية فعلية')
content = content.replace('نصيحة استثمارية فعلية', 'توصية تداول حقيقية')
content = content.replace('لتحقيق عوائد افتراضية عالية', 'لتحقيق نمو افتراضي عالٍ')
content = content.replace('غير مستثمرة', 'متاحة للتداول الافتراضي')
content = content.replace('هل اللاعبون الذين استثمرت فيهم', 'هل اللاعبون الذين تداولت في أسهمهم')
content = content.replace('ضع مستويات تقريبية للربح والخسارة قبل الدخول', 'ضع مستويات تقريبية للربح الافتراضي والخسارة الافتراضية قبل الدخول')

# Write the polished script back
with open(script_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("update_articles.py polished successfully!")
