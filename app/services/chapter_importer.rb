# frozen_string_literal: true

module ChapterImporter
  class Error < StandardError; end

  HIGH_CONFIDENCE = 0.95
  BARE_NUMBER_CONFIDENCE = 0.6
  REVIEW_THRESHOLD = 0.7
end
