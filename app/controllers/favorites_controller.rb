class FavoritesController < ApplicationController
  before_action :authenticate_user!

  def index
    @books = current_user.favorited_books.includes(:user).order(favorites: { created_at: :desc })
  end
end
