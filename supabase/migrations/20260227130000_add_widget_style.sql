ALTER TABLE configs ADD COLUMN IF NOT EXISTS widget_style text DEFAULT 'chat' CHECK (widget_style IN ('chat', 'survey'));
