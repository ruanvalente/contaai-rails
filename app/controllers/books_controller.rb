class BooksController < ApplicationController
  before_action :authenticate_user!, except: [ :index, :show ]
  before_action :set_book, only: [ :show, :edit, :update, :destroy, :publish, :read, :write ]

  def index
    @books = Book.published.includes(:user).order(published_at: :desc)
  end

  def show
  end

  def new
    @book = current_user.books.build
  end

  def create
    @book = current_user.books.build(book_params)
    if @book.save
      redirect_to @book, notice: "Livro criado com sucesso."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    authorize_book_owner!
  end

  def update
    unless @book.user == current_user
      redirect_to root_path, alert: "Não autorizado." and return
    end
    if @book.update(book_params)
      redirect_to @book, notice: "Livro atualizado com sucesso."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_book_owner!
    @book.destroy
    redirect_to dashboard_path, notice: "Livro excluído com sucesso."
  end

  def publish
    unless @book.user == current_user && @book.draft?
      redirect_to @book, alert: "Não foi possível publicar o livro." and return
    end
    @book.update(status: :published, published_at: Time.current)
    redirect_to @book, notice: "Livro publicado com sucesso."
  end

  def write
    authorize_book_owner!
    @chapters = @book.chapters.ordered
    @active_chapter = @chapters.first
  end

  def read
  end

  private

  def set_book
    @book = Book.find(params[:id])
  end

  def authorize_book_owner!
    redirect_to root_path, alert: "Não autorizado." unless @book.user == current_user
  end

  def book_params
    params.require(:book).permit(:title, :description, :content, :category, :cover_color, :author_name)
  end
end
