class Chapter < ApplicationRecord
  belongs_to :book, touch: true

  validates :title, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :ordered, -> { order(position: :asc) }

  before_create :set_default_position
  after_save :recalculate_book_word_count
  after_destroy :recalculate_book_word_count, :reorder_positions

  private

  def set_default_position
    self.position ||= book.chapters.maximum(:position).to_i + 1
  end

  def recalculate_book_word_count
    total = book.chapters.sum(:word_count)
    book.update_column(:word_count, total)
  end

  def reorder_positions
    book.chapters.ordered.each_with_index do |chapter, index|
      chapter.update_column(:position, index) unless chapter.position == index
    end
  end
end
