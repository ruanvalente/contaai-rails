class AuthorFollow < ApplicationRecord
  belongs_to :follower, class_name: "User"
  belongs_to :author, class_name: "User"

  validates :follower_id, uniqueness: { scope: :author_id }
  validate :cannot_follow_self

  private

  def cannot_follow_self
    errors.add(:follower_id, "não pode seguir a si mesmo") if follower_id == author_id
  end
end
