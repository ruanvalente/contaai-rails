# frozen_string_literal: true

class BookImport < ApplicationRecord
  belongs_to :book
  belongs_to :user

  enum :status, { pending: 0, processing: 1, ready: 2, confirmed: 3, failed: 4 }

  validates :filename, presence: true
  validates :status, presence: true

  scope :recent_first, -> { order(created_at: :desc) }

  def parsed_chapters
    parsed_data.is_a?(Array) ? parsed_data : []
  end

  def mark_ready!(chapters_data)
    update!(
      status: :ready,
      parsed_data: chapters_data.map(&:to_h).map(&:stringify_keys)
    )
  end

  def mark_failed!(message)
    update!(status: :failed, error_message: message)
  end

  def needs_review?
    parsed_chapters.any? { |chapter| chapter["confidence"].to_f < ChapterImporter::REVIEW_THRESHOLD }
  end
end
