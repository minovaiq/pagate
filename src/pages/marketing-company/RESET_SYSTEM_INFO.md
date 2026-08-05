# زر تصفير النظام

المكان: صفحة التقارير.

عند التصفير يتم حذف بيانات المشروع من:
- transactions
- page_campaigns
- promotion_ad_spend_entries
- promotion_cards
- promotion_weekly_audits
- promotion_monthly_archives
- marketing_notifications

لا يتم حذف أي سجل من جدول clients.

ملاحظة: يجب أن تكون سياسات RLS الحالية تسمح للمستخدم بحذف بيانات المشروع من الجداول المذكورة.
