# frozen_string_literal: true

module ChapterWordCountConcern
  extend ActiveSupport::Concern

  BLOCK_TAG_PATTERN = %r{</?(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|table|tr|td|br|hr)[^>]*>}.freeze

  included do
    before_save :recalculate_word_and_char_count_from_content, if: :content_changed?

    def recalculate_word_and_char_count_from_content
      html = content.to_s.gsub(BLOCK_TAG_PATTERN, " ")
      plain_text = ActionView::Base.full_sanitizer.sanitize(html).to_s.squeeze(" ").strip

      self.word_count = plain_text.empty? ? 0 : plain_text.split(/\s+/).length
      self.character_count = plain_text.length
    end
  end
end
