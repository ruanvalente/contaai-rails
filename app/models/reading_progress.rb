class ReadingProgress < ApplicationRecord
  belongs_to :user
  belongs_to :book

  enum :status, { reading: 0, completed: 1, paused: 2 }

  validates :percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
end
