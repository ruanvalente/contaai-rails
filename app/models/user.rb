class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :timeoutable, :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :lockable, :trackable

  enum :role, { reader: 0, author: 1 }

  has_one_attached :avatar

  has_many :books, dependent: :destroy
  has_many :ratings, dependent: :destroy
  has_many :favorites, dependent: :destroy
  has_many :favorited_books, through: :favorites, source: :book
  has_many :reading_progresses, dependent: :destroy
  has_one :user_reading_preference, dependent: :destroy

  has_many :active_author_follows, class_name: "AuthorFollow",
                                  foreign_key: :follower_id,
                                  dependent: :destroy
  has_many :following_authors, through: :active_author_follows, source: :author

  has_many :passive_author_follows, class_name: "AuthorFollow",
                                    foreign_key: :author_id,
                                    dependent: :destroy
  has_many :followers, through: :passive_author_follows, source: :follower
end
