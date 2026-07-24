class DashboardController < ApplicationController
  before_action :authenticate_user!

  def index
    @user = current_user
    @books = @user.books.order(updated_at: :desc)
    @stats = {
      total_books: @user.books.count,
      published_books: @user.books.published.count,
      drafts: @user.books.where(status: :draft).count,
      total_words: @user.books.sum(:word_count),
      total_readings: ReadingProgress.joins(:book).where(books: { user_id: @user.id }).count,
      average_rating: @user.books.average(:average_rating)&.round(1) || 0
    }
    @platform_stats = {
      total_authors: User.joins(:books).distinct.count,
      total_books: Book.published.count,
      total_readers: User.where(role: :reader).count
    }
  end
end
