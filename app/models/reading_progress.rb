class ReadingProgress < ApplicationRecord
  belongs_to :user
  belongs_to :book
  belongs_to :current_chapter, class_name: "Chapter", optional: true

  enum :status, { reading: 0, completed: 1, paused: 2 }

  validates :percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }

  scope :active, -> { where(status: :reading).order(last_read_at: :desc) }

  def recalculate_percentage!
    total = book.chapters.count
    return update!(percentage: 0, status: :reading) if total.zero?

    read_count = book.chapters.where("position <= ?", current_chapter&.position || 0).count
    new_percentage = ((read_count.to_f / total) * 100).round

    new_status = if new_percentage >= 100
                   :completed
                 else
                   :reading
                 end

    update!(
      percentage: new_percentage,
      status: new_status,
      completed_at: new_status == :completed? ? Time.current : nil
    )
  end
end
