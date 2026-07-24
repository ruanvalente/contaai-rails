class ExploreController < ApplicationController
  def index
    @featured_books = Book.published.includes(:user).order(published_at: :desc).limit(8)
    @categories = Book.categories.keys
  end
end
