ALTER TABLE configs DROP CONSTRAINT IF EXISTS configs_widget_style_check;
ALTER TABLE configs ADD CONSTRAINT configs_widget_style_check
  CHECK (widget_style IN ('chat', 'survey', 'typeform'));
