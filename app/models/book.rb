class Book < ApplicationRecord
  include ContentSanitizer

  belongs_to :user

  has_one_attached :cover_image

  has_many :chapters, -> { order(position: :asc) }, dependent: :destroy
  has_many :book_imports, dependent: :destroy
  has_many :ratings, dependent: :destroy
  has_many :favorites, dependent: :destroy
  has_many :reading_progresses, dependent: :destroy

  enum :category, { fiction: 0, non_fiction: 1, poetry: 2, essay: 3, short_story: 4, other: 5 }
  enum :status, { draft: 0, published: 1, archived: 2 }

  scope :published, -> { where(status: :published) }
  scope :recent, -> { order(published_at: :desc) }

  validates :title, presence: true
  validates :author_name, presence: true
  validates :category, presence: true

  def has_chapters?
    chapters.any?
  end

  def publishable?
    title.present? && has_chapters? && chapters.sum(:word_count) > 0 && category.present?
  end
end
