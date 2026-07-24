class UserReadingPreference < ApplicationRecord
  belongs_to :user

  validates :font_size, numericality: { greater_than_or_equal_to: 10, less_than_or_equal_to: 32 }
end
