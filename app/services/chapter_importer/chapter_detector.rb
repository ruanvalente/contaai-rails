# frozen_string_literal: true

require "cgi"

module ChapterImporter
  class ChapterDetector
    MARKER_PATTERN = /\A\s*(?<marker>capítulo|capitulo|chapter)\s+(?<number>\d+|[ivxlcdm]+)(?:\s*[—–\-:.]\s*(?<inline_subtitle>.+))?\s*\z/
    BARE_NUMBER_PATTERN = /\A\s*(?<number>\d{1,3}|[ivxlcdm]{1,7})\s*\z/
    SENTENCE_END_PATTERN = /[.!?…]\z/
    MAX_SUBTITLE_LENGTH = 80

    Chapter = Struct.new(:title, :content, :confidence, keyword_init: true) do
      def needs_review? = confidence < REVIEW_THRESHOLD
    end

    class << self
      def detect(text)
        lines = text.split("\n")
        chapters = []
        state = nil

        lines.each_with_index do |line, index|
          if (match = match_chapter_start(line))
            chapters << build_chapter(state) if state
            state = new_state(match)
          elsif state.nil?
            next
          elsif can_take_subtitle?(state, line) &&
              subtitle_line?(line) &&
              next_is_blank_or_end?(lines, index)
            apply_subtitle(state, line)
          else
            state[:content_lines] << line
          end
        end

        chapters << build_chapter(state) if state
        chapters
      end

      def html_from_text(text)
        paragraphs_to_html(text.to_s.split("\n"))
      end

      private

      def match_chapter_start(line)
        normalized = line.downcase

        if (match = normalized.match(MARKER_PATTERN))
          marked_chapter(line, normalized, match)
        elsif normalized.match?(BARE_NUMBER_PATTERN)
          bare_number(line)
        end
      end

      def marked_chapter(original, normalized, match)
        ChapterStart.new(
          base_title: "#{match[:marker].capitalize} #{slice_original(original, match, :number)}",
          inline_subtitle: slice_optional_inline_subtitle(original, normalized, match),
          confidence: HIGH_CONFIDENCE
        )
      end

      def bare_number(original)
        match = original.downcase.match(BARE_NUMBER_PATTERN)

        ChapterStart.new(
          base_title: slice_original(original, match, :number),
          inline_subtitle: nil,
          confidence: BARE_NUMBER_CONFIDENCE
        )
      end

      def slice_original(original, match, group)
        original[match.begin(group)...match.end(group)]
      end

      def slice_optional_inline_subtitle(original, normalized, match)
        return nil unless match[:inline_subtitle]

        slice_original(original, match, :inline_subtitle)&.strip
      end

      def new_state(start)
        state = {
          base_title: start.base_title,
          confidence: start.confidence,
          content_lines: []
        }

        if start.inline_subtitle.present?
          state[:title] = compose_title(start.base_title, start.inline_subtitle)
        end

        state
      end

      def can_take_subtitle?(state, line)
        pending_subtitle?(state) && state[:content_lines].empty? && line.strip.present?
      end

      def pending_subtitle?(state)
        !state.key?(:title)
      end

      def next_is_blank_or_end?(lines, index)
        next_line = lines[index + 1]
        next_line.nil? || next_line.strip.empty?
      end

      def subtitle_line?(line)
        trimmed = line.strip
        return false if trimmed.blank?
        return false if trimmed.length > MAX_SUBTITLE_LENGTH
        return false if trimmed.downcase.match?(MARKER_PATTERN) || trimmed.match?(BARE_NUMBER_PATTERN)

        !trimmed.match?(SENTENCE_END_PATTERN)
      end

      def apply_subtitle(state, line)
        state[:title] = compose_title(state[:base_title], line.strip)
      end

      def compose_title(base_title, subtitle)
        "#{base_title} — #{subtitle}"
      end

      def build_chapter(state)
        Chapter.new(
          title: state[:title] || state[:base_title],
          content: paragraphs_to_html(state[:content_lines]),
          confidence: state[:confidence]
        )
      end

      def paragraphs_to_html(lines)
        blocks = lines.join("\n").split(/\n{2,}/)
        blocks.filter_map do |block|
          paragraph = block.lines.map(&:strip).reject(&:blank?).join(" ").strip
          "<p>#{CGI.escapeHTML(paragraph)}</p>" if paragraph.present?
        end.join
      end
    end

    ChapterStart = Struct.new(:base_title, :inline_subtitle, :confidence, keyword_init: true)
  end
end
