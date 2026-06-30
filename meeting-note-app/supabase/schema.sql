-- 会议记录助手 - 数据库表结构
-- 在 Supabase SQL Editor 中运行此文件

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 会议记录表
CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  participants TEXT[] DEFAULT '{}',
  location TEXT DEFAULT '',
  agenda TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  conclusion TEXT DEFAULT '',
  action_items JSONB DEFAULT '[]'::jsonb,
  meeting_type TEXT DEFAULT 'general',
  template_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 记录模板表
CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meeting_type TEXT DEFAULT 'general',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_meetings_user_date ON meetings(user_id, meeting_date);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_templates_user ON templates(user_id);

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 行级安全策略 (RLS)
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "用户只能查看自己的会议记录"
  ON meetings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能创建自己的会议记录"
  ON meetings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的会议记录"
  ON meetings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的会议记录"
  ON meetings
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能查看自己的模板"
  ON templates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能创建自己的模板"
  ON templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的模板"
  ON templates
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的模板"
  ON templates
  FOR DELETE
  USING (auth.uid() = user_id);
